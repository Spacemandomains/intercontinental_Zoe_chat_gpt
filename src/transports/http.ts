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
