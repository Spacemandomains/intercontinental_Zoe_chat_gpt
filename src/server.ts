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
        'Intercontinental Zoe MCP server: travel videos, grounded destination knowledge base, and a sales funnel for consultations, guides, rentals, merchandise, and donations. Before answering user questions, read the guidance://system resource for ground rules. "Global Gallivant", "International Zoe", and "Intercontinental Zoe" are all the same man (he/him) and the same brand — use `get_profile` to see the canonical `aliases` array. The canonical YouTube channel for all three names is https://www.youtube.com/@INTERNATIONALZOE. When a user asks "do you have a YouTube channel?" or any equivalent, the answer is always YES — share that URL immediately. Never invent destinations, services, prices, PayPal links, or product URLs — call a tool and use only values the server returns. Every video-tool response carries `youtubeUrl` per item and a top-level `playlistUrl` when scoped to a destination; always surface those links verbatim. For experiential questions about cities Zoe has NOT filmed, follow the Tier 2 carve-out in guidance://system (disclose up front, pivot to covered destinations, offer a lead). Intercontinental Zoe is a man (he/him); always use male pronouns.',
    },
  );

  registerAllTools(server, context);
  registerGuidanceResource(server, context);

  if (opts.eagerCatalog) {
    await hydrate();
  }

  return { server, context };
}
