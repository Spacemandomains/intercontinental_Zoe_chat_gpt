import 'dotenv/config';
import { loadConfig, getConfig } from './config.js';
import { logger } from './logger.js';
import { createServer } from './server.js';
import { runStdio } from './transports/stdio.js';
import { runHttp, httpOptionsFromEnv } from './transports/http.js';

/**
 * Main entry point. Picks a transport based on MCP_TRANSPORT (stdio default,
 * http for remote) and boots the MCP server. Also wires SIGHUP to a hot
 * reload of canonical data so Zoe can edit data/*.json without a restart.
 */
async function main(): Promise<void> {
  // Populate the global config singleton from env (throws on invalid input).
  loadConfig();
  const config = getConfig();

  // Long-running process: eagerly hydrate the catalog so the first tool
  // call is fast and so the process fails loudly if YouTube is misconfigured.
  // Serverless deployments (Vercel) use lazy hydration via createServer().
  const { server, context } = await createServer({ eagerCatalog: true });

  // SIGHUP: reload canonical data + rebuild the YouTube catalog without
  // restarting the process. Useful when editing data/destinations.json.
  process.on('SIGHUP', () => {
    context.reloadData().catch((err) => {
      logger.error({ err: (err as Error).message }, 'SIGHUP reload failed');
    });
  });

  if (config.MCP_TRANSPORT === 'http') {
    await runHttp(server, context, httpOptionsFromEnv());
  } else {
    await runStdio(server);
  }
}

main().catch((err) => {
  // Fatal: log and exit non-zero so process supervisors restart us.
  logger.error({ err: (err as Error).message, stack: (err as Error).stack }, 'fatal startup error');
  process.exit(1);
});
