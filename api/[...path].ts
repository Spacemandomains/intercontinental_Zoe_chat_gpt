/**
 * Vercel serverless function entry point.
 *
 * A single catch-all function that mounts the shared Express app. All routes
 * (/healthz, /openapi.json, /mcp, /actions/:tool) are served by this one
 * function; vercel.json rewrites every path under the project to
 * /api/index so Express sees the original URL.
 *
 * Cold-start strategy:
 *   1. `loadConfig()` + `loadCanonicalData()` run once at module scope (tens
 *      of milliseconds of JSON parsing).
 *   2. `createServer()` is called with `eagerCatalog: false` — the YouTube
 *      catalog is NOT hydrated until the first tool call that needs it.
 *      Tools that only touch canonical data (list_services, list_products,
 *      list_destinations, list_support_options, get_service_details,
 *      start_lead) return in <50ms on cold starts.
 *   3. The first call to a YouTube tool (list_videos, search_videos,
 *      get_video_details, get_video_transcript, get_destination_overview)
 *      triggers `buildCatalog()`, which fans out per-destination playlist
 *      fetches in parallel — ~2s for 25 destinations.
 *   4. Subsequent warm invocations reuse the cached `appPromise`, so the
 *      catalog stays hot for the lifetime of the Vercel container.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { loadConfig, getConfig } from '../src/config.js';
import { createServer } from '../src/server.js';
import { createHttpApp } from '../src/transports/http.js';

// -----------------------------------------------------------------------------
// Resolve the canonical data directory relative to this file, not process.cwd().
// Vercel runs functions from /var/task; computing an absolute path from the
// bundled file location is the only reliable way to find data/.
// -----------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = resolve(__dirname, '..', 'data');
}

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

let appPromise: Promise<NodeHandler> | null = null;

async function getApp(): Promise<NodeHandler> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    loadConfig();
    const config = getConfig();
    // Lazy catalog: cold-start returns fast; YouTube tools hydrate on demand.
    const { server, context } = await createServer({ eagerCatalog: false });
    const app = createHttpApp(server, context, {
      port: config.PORT,
      authToken: config.HTTP_AUTH_TOKEN || undefined,
    });
    return app as unknown as NodeHandler;
  })().catch((err) => {
    // If initialization fails (e.g., bad env vars), clear the cache so the
    // next request retries rather than serving a permanently broken function.
    appPromise = null;
    throw err;
  });
  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Vercel serves this function from /api/index; strip that prefix so the
  // Express routes (/mcp, /actions/:tool, /healthz, /openapi.json) match.
  if (req.url) {
    if (req.url === '/api' || req.url === '/api/') {
      req.url = '/';
    } else if (req.url.startsWith('/api/')) {
      req.url = req.url.slice(4);
    }
  }
  try {
    const app = await getApp();
    app(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'initialization failed', detail: message }));
    }
  }
}

// Vercel function config: give the container enough memory and time to hydrate
// the YouTube catalog on the first tool call. 60s is the Pro tier maxDuration;
// Hobby tier is capped at 10s and will time out on the FIRST YouTube tool
// invocation of a cold container — see docs/vercel-deploy.md.
export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 60,
  memory: 1024,
};
