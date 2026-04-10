import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadCanonicalData } from './data/loader.js';
import { buildCatalog } from './youtube/catalog.js';
import { registerAllTools } from './tools/index.js';
import { registerGuidanceResource } from './resources/guidance.js';
import type { ToolContext, ToolHandler } from './tools/types.js';
import { getConfig } from './config.js';
import { logger } from './logger.js';

export const SERVER_NAME = 'intercontinental-zoe';
export const SERVER_VERSION = '0.1.0';

export interface ServerHandle {
  server: McpServer;
  context: ToolContext;
}

export async function createServer(): Promise<ServerHandle> {
  const config = getConfig();

  logger.info({ dataDir: config.DATA_DIR }, 'loading canonical data');
  const data = await loadCanonicalData(config.DATA_DIR);
  logger.info(
    {
      destinations: data.destinations.length,
      services: data.services.length,
      products: data.products.length,
      supportOptions: data.support.options.length,
    },
    'canonical data loaded',
  );

  logger.info('building YouTube catalog from per-country playlists');
  const catalog = await buildCatalog(data.destinations);
  logger.info(
    {
      uniqueVideos: catalog.videos.length,
      destinationsWithVideos: Array.from(catalog.byDestination.entries()).filter(
        ([, vs]) => vs.length > 0,
      ).length,
    },
    'catalog ready',
  );

  const context: ToolContext = {
    data,
    catalog,
    handlers: new Map<string, ToolHandler>(),
    async refreshCatalog() {
      logger.info('refreshing YouTube catalog');
      const updated = await buildCatalog(context.data.destinations);
      context.catalog = updated;
      logger.info({ uniqueVideos: updated.videos.length }, 'catalog refreshed');
    },
    async reloadData() {
      logger.info('reloading canonical data');
      const updated = await loadCanonicalData(config.DATA_DIR);
      context.data = updated;
      await context.refreshCatalog();
    },
  };

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        'Intercontinental Zoe MCP server: travel videos, grounded destination knowledge base, and a sales funnel for consultations, guides, rentals, merchandise, and donations. Before answering user questions, read the guidance://system resource for ground rules. Never invent destinations, services, prices, or URLs — always call a tool and use only values returned by the server.',
    },
  );

  registerAllTools(server, context);
  registerGuidanceResource(server, context);

  return { server, context };
}
