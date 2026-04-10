import pino from 'pino';
import { getConfig } from './config.js';

function createLogger() {
  const config = (() => {
    try {
      return getConfig();
    } catch {
      return { LOG_LEVEL: 'info' as const, NODE_ENV: 'production' as const, MCP_TRANSPORT: 'stdio' as const };
    }
  })();

  // In stdio transport we MUST write logs to stderr so we don't corrupt the JSON-RPC stream on stdout.
  const destination = config.MCP_TRANSPORT === 'stdio' ? pino.destination(2) : undefined;

  return pino(
    {
      level: config.LOG_LEVEL,
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      ...(config.NODE_ENV === 'development' && config.MCP_TRANSPORT !== 'stdio'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true },
            },
          }
        : {}),
    },
    destination,
  );
}

export const logger = createLogger();
