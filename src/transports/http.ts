import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { SERVER_NAME, SERVER_VERSION } from '../server.js';
import { ALL_TOOL_NAMES, type ToolName } from '../tools/index.js';
import { generateOpenApiDocument } from '../openapi/generate.js';
import type { ToolContext } from '../tools/types.js';

export interface HttpTransportOptions {
  port: number;
  authToken?: string;
}

// Self-contained HTML privacy policy served at GET /privacy.
// Kept inline (no external CSS/JS) so it works behind the Vercel serverless
// catch-all function without any extra build step or static asset wiring.
// OpenAI requires Custom GPTs with Actions to expose a public privacy policy
// URL, and this endpoint is intentionally unauthenticated so it can be
// fetched anonymously during GPT validation.
const PRIVACY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy &mdash; Intercontinental Zoe</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 760px;
    margin: 2rem auto;
    padding: 0 1.25rem;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fafafa;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e8e8e8; background: #141414; }
    a { color: #8ab4f8; }
  }
  h1 { margin-top: 0; }
  h2 { margin-top: 2rem; }
  code { background: rgba(127,127,127,0.15); padding: 0.1rem 0.35rem; border-radius: 3px; }
  footer { margin-top: 3rem; font-size: 0.875rem; opacity: 0.7; }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> April 10, 2026</p>

<p>This privacy policy describes how the Intercontinental Zoe MCP server
(&ldquo;the service&rdquo;) handles information. The service powers a ChatGPT
Custom GPT via the Actions API and the Model Context Protocol (MCP). It is
operated by Intercontinental Zoe, an independent travel-content creator.</p>

<h2>1. What the service does</h2>
<p>The service exposes read-only travel content (videos, destination
summaries, products, services) and a single write endpoint
(<code>start_lead</code>) that lets visitors submit contact information to
request follow-up about consultations, guides, rentals, merchandise, or
donations.</p>

<h2>2. Information we process</h2>
<h3>Anonymous query data</h3>
<p>Most tool calls (for example <code>list_videos</code>,
<code>search_videos</code>, <code>get_destination_overview</code>) only read
canonical catalog data. Their arguments &mdash; destination IDs, search
keywords, pagination &mdash; are processed in memory to produce a response
and are not persisted or associated with any individual.</p>

<h3>Lead submissions</h3>
<p>When you explicitly call the <code>start_lead</code> tool (for example, by
asking the ChatGPT agent to book a consultation), you provide:</p>
<ul>
<li>Your name</li>
<li>Your email address</li>
<li>A free-text message describing what you are interested in</li>
<li>The type of lead (consultation, guide, rental, merchandise, donation, general)</li>
<li>Optional references to a destination, service, or product</li>
</ul>
<p>This information is forwarded by email to Intercontinental Zoe so we can
follow up with you. It is retained only as long as necessary to respond to
your inquiry and keep reasonable business records.</p>

<h2>3. Third-party services</h2>
<p>The service relies on a small number of third-party providers. Information
may flow to them as follows:</p>
<ul>
<li><strong>YouTube Data API</strong> &mdash; read-only queries for public
video metadata and captions. No personal data is sent.</li>
<li><strong>Resend</strong> &mdash; used to deliver lead-submission emails.
Your name, email, and message pass through Resend.</li>
<li><strong>PayPal</strong> &mdash; if you choose to pay for a service, you
are redirected to PayPal&rsquo;s own checkout page. Payment card information
never touches this server.</li>
<li><strong>Crisp</strong> &mdash; linked from tool responses as a live chat
handoff. If you choose to open a chat, Crisp&rsquo;s own privacy policy
applies.</li>
<li><strong>Vercel</strong> &mdash; hosts this server and may log standard
request metadata (IP, user-agent, timestamp) for operational and
abuse-prevention purposes.</li>
</ul>

<h2>4. Cookies and tracking</h2>
<p>The API endpoints of this server do not set cookies and do not use
analytics, fingerprinting, or advertising trackers.</p>

<h2>5. Data retention</h2>
<p>Lead-submission emails are retained only as long as necessary to respond
to your request and keep reasonable business records. Request logs held by
the hosting provider follow that provider&rsquo;s standard retention
schedule.</p>

<h2>6. Your rights</h2>
<p>You may request access to, correction of, or deletion of any personal
information you have submitted by contacting us at the email address below.
Where required by law (for example, under the GDPR or CCPA), we will honor
applicable rights within a reasonable time.</p>

<h2>7. Children&rsquo;s privacy</h2>
<p>This service is not directed at children under 13, and we do not
knowingly collect personal information from children.</p>

<h2>8. Changes to this policy</h2>
<p>If this policy changes, the updated version will be published at this URL
and the &ldquo;Last updated&rdquo; date at the top will be revised.</p>

<h2>9. Contact</h2>
<p>For privacy questions or data-deletion requests, contact:
<a href="mailto:contact@intercontinentalzoe.com">contact@intercontinentalzoe.com</a></p>

<footer>Intercontinental Zoe MCP server &middot; privacy policy served at <code>/privacy</code></footer>
</body>
</html>
`;

/**
 * Creates the express app but does not call .listen().
 * Exported separately so tests can use supertest against the returned app.
 */
export function createHttpApp(
  server: McpServer,
  ctx: ToolContext,
  opts: HttpTransportOptions,
) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // --- Bearer auth middleware (only applied to /mcp and /actions if token set) ---
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!opts.authToken) return next();
    const header = req.header('authorization') ?? '';
    const expected = `Bearer ${opts.authToken}`;
    if (header !== expected) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };

  // --- Health ---
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, name: SERVER_NAME, version: SERVER_VERSION });
  });

  // --- Public smoke test ---
  // Unauthenticated end-to-end check: invokes list_destinations in-process
  // and returns the result plus latency. Safe to leave public because it
  // only reads canonical data (no secrets, no mutations, no PII). Callers
  // do not need to supply any credentials.
  app.get('/test', async (_req, res) => {
    const handler = ctx.handlers.get('list_destinations');
    if (!handler) {
      res.status(500).json({
        ok: false,
        error: 'list_destinations handler not registered',
      });
      return;
    }
    const start = Date.now();
    try {
      const result = await handler({ limit: 5 });
      res.json({
        ok: true,
        latencyMs: Date.now() - start,
        tool: 'list_destinations',
        result,
      });
    } catch (err) {
      logger.error({ err: (err as Error).message }, '/test invocation failed');
      res.status(500).json({
        ok: false,
        latencyMs: Date.now() - start,
        error: (err as Error).message,
      });
    }
  });

  // --- Privacy policy ---
  // Public, unauthenticated HTML page. Required by OpenAI for Custom GPTs
  // with Actions: the privacy URL must be reachable anonymously.
  app.get('/privacy', (_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(PRIVACY_HTML);
  });

  // --- OpenAPI spec (for ChatGPT Custom GPT Actions) ---
  app.get('/openapi.json', (req, res) => {
    const host = req.get('host') ?? `localhost:${opts.port}`;
    const proto = (req.get('x-forwarded-proto') ?? req.protocol ?? 'http').split(',')[0];
    const baseUrl = `${proto}://${host}`;
    res.json(generateOpenApiDocument(baseUrl, Boolean(opts.authToken)));
  });

  // --- Streamable HTTP MCP transport ---
  // Stateless mode: one transport per request. Simpler for serverless-ish deploys
  // and works with ChatGPT's MCP connector which does not maintain sessions.
  app.all('/mcp', requireAuth, async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      res.on('close', () => {
        transport.close().catch(() => undefined);
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'MCP request failed');
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'internal error' },
          id: null,
        });
      }
    }
  });

  // --- REST mirror for ChatGPT Custom GPT Actions ---
  // One POST endpoint per tool. Forwards to the same validated handler the
  // MCP transport uses, via the shared ctx.handlers map populated during
  // tool registration. This avoids re-dispatching through JSON-RPC plumbing.
  const toolNames = new Set<ToolName>(ALL_TOOL_NAMES);
  app.post('/actions/:toolName', requireAuth, async (req, res) => {
    const toolName = req.params.toolName as ToolName;
    if (!toolNames.has(toolName)) {
      res.status(404).json({ error: `unknown tool: ${toolName}` });
      return;
    }
    const handler = ctx.handlers.get(toolName);
    if (!handler) {
      // Should be impossible: every tool in ALL_TOOL_NAMES is registered at
      // startup, which populates ctx.handlers. Guard anyway for clarity.
      res.status(500).json({ error: `handler not registered: ${toolName}` });
      return;
    }
    try {
      const result = await handler(req.body ?? {});
      res.json({ actionId: randomUUID(), result });
    } catch (err) {
      logger.error({ err: (err as Error).message, toolName }, 'action invocation failed');
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return app;
}

export async function runHttp(
  server: McpServer,
  ctx: ToolContext,
  opts: HttpTransportOptions,
): Promise<void> {
  const app = createHttpApp(server, ctx, opts);
  await new Promise<void>((resolve) => {
    app.listen(opts.port, () => {
      logger.info(
        { port: opts.port, authRequired: Boolean(opts.authToken) },
        'MCP server listening on http',
      );
      resolve();
    });
  });
}

/** Loads options from the validated config. */
export function httpOptionsFromEnv(): HttpTransportOptions {
  const config = getConfig();
  return {
    port: config.PORT,
    authToken: config.HTTP_AUTH_TOKEN || undefined,
  };
}
