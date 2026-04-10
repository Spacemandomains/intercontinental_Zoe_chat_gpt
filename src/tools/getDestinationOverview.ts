import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { getDestinationOverviewInput } from './schemas.js';
import { toolResult, notFoundResult } from './response.js';
import { buildDestinationOverview } from '../services/overview.js';
import { registerTool } from './registrar.js';

export function registerGetDestinationOverview(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'get_destination_overview',
    title: 'Full overview for a destination',
    description:
      'Return a bundled overview for a destination — Zoe\'s summary, recent videos from that country, the matching destination guide, available rentals, recommended services (consultation, itinerary), and practical tips. Use this as the first tool call when a user says they are planning a trip somewhere. Return only values from the canonical data — never invent videos, guides, rentals, or tips.',
    inputSchema: getDestinationOverviewInput,
    handler: async ({ destinationIdOrName, maxVideos }) => {
      const overview = buildDestinationOverview(ctx.data, ctx.catalog, destinationIdOrName, {
        maxVideos,
      });

      if (!overview) {
        return notFoundResult(
          `No destination matches "${destinationIdOrName}" in Zoe\'s database. Zoe may not have covered it yet.`,
          [
            {
              label: 'See all destinations Zoe has visited',
              tool: 'list_destinations',
              args: {},
            },
            {
              label: 'Ask Zoe to add this destination',
              tool: 'start_lead',
              args: { leadType: 'general' },
            },
          ],
        );
      }

      const { destination, videos, guide, rentals, recommendedServices, tips } = overview;

      return toolResult({
        ok: true,
        destination: {
          id: destination.id,
          name: destination.name,
          country: destination.country,
          region: destination.region,
          continent: destination.continent,
          summary: destination.summary,
          highlights: destination.highlights,
          bestTimeToVisit: destination.bestTimeToVisit,
        },
        videos: videos.map((v) => ({
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
          durationSeconds: v.durationSeconds,
          thumbnailUrl: v.thumbnailUrl,
          youtubeUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        })),
        guide: guide
          ? {
              id: guide.id,
              title: guide.title,
              description: guide.description,
              price: guide.price,
              url: guide.url,
              platform: guide.platform,
            }
          : null,
        rentals: rentals.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          price: r.price,
          url: r.url,
          platform: r.platform,
        })),
        recommendedServices: recommendedServices.map((s) => ({
          id: s.id,
          name: s.name,
          tagline: s.tagline,
          price: s.price,
        })),
        tips,
        nextSteps: [
          ...(guide
            ? [
                {
                  label: `Buy the ${destination.name} guide`,
                  url: guide.url,
                  description: `$${guide.price?.amount ?? ''} ${guide.price?.currency ?? ''}`.trim(),
                },
              ]
            : []),
          {
            label: 'Book a consultation for this trip',
            tool: 'get_service_details',
            args: { serviceId: 'consultation' },
          },
          ...(rentals.length > 0
            ? [
                {
                  label: `Browse rentals in ${destination.name}`,
                  tool: 'list_products',
                  args: { type: 'rental', destination: destination.id },
                },
              ]
            : []),
        ],
      });
    },
  });
}
