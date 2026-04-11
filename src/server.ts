import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadCanonicalData } from './data/loader.js';
import { buildCatalog, emptyCatalog, type Catalog } from './youtube/catalog.js';
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

export interface CreateServerOptions {
  /**
   * If true, eagerly hydrate the YouTube catalog before returning.
   * Defaults to false so serverless cold starts aren't blocked on YouTube
   * API calls. Long-running deploys (stdio, Fly/Render-style) can pass
   * `{ eagerCatalog: true }` to fail fast if YouTube is unreachable.
   */
  eagerCatalog?: boolean;
}

export async function createServer(opts: CreateServerOptions = {}): Promise<ServerHandle> {
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

  // Catalog is lazy by default: cold serverless starts return immediately
  // and the first tool call that needs YouTube data triggers hydration.
  let inflight: Promise<Catalog> | null = null;
  const hydrate = (): Promise<Catalog> => {
    if (!inflight) {
      logger.info('hydrating YouTube catalog from per-country playlists');
      inflight = buildCatalog(context.data.destinations)
        .then((built) => {
          context.catalog = built;
          logger.info(
            {
              uniqueVideos: built.videos.length,
              destinationsWithVideos: Array.from(built.byDestination.entries()).filter(
                ([, vs]) => vs.length > 0,
              ).length,
            },
            'catalog ready',
          );
          return built;
        })
        .catch((err) => {
          // Reset so a later call can retry — don't wedge the server on
          // a transient YouTube API hiccup.
          inflight = null;
          logger.error({ err: (err as Error).message }, 'catalog hydration failed');
          throw err;
        });
    }
    return inflight;
  };

  const context: ToolContext = {
    data,
    catalog: emptyCatalog(),
    handlers: new Map<string, ToolHandler>(),
    ensureCatalog: () => hydrate(),
    async refreshCatalog() {
      logger.info('refreshing YouTube catalog');
      inflight = null;
      await hydrate();
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
        'Intercontinental Zoe MCP server: travel videos, grounded destination knowledge base, and a sales funnel for consultations, guides, rentals, merchandise, and donations. Before answering user questions, read the guidance://system resource for ground rules. Never invent destinations, services, prices, or URLs — always call a tool and use only values returned by the server. Intercontinental Zoe is a man (he/him); always use male pronouns and call `get_profile` before making identity claims. The canonical YouTube channel is https://www.youtube.com/@INTERNATIONALZOE — always surface this link when the user asks about videos.',
    },
  );

  registerAllTools(server, context);
  registerGuidanceResource(server, context);

  if (opts.eagerCatalog) {
    await hydrate();
  }

  return { server, context };
}
