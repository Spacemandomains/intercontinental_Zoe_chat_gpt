import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { listDestinationsInput } from './schemas.js';
import { toolResult } from './response.js';
import { filterDestinations } from '../services/destinations.js';
import { registerTool } from './registrar.js';

export function registerListDestinations(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'list_destinations',
    title: 'List destinations Zoe has visited',
    description:
      'List the destinations (countries) Zoe has visited, optionally filtered by region (e.g., "Southeast Asia"), country, or continent. Return only destinations present in the canonical data — never guess how many destinations Zoe has been to or invent countries.',
    inputSchema: listDestinationsInput,
    handler: async (args) => {
      const filtered = filterDestinations(ctx.data.destinations, {
        region: args.region,
        country: args.country,
        continent: args.continent,
      });

      const destinations = filtered.slice(0, args.limit).map((d) => ({
        id: d.id,
        name: d.name,
        country: d.country,
        region: d.region,
        continent: d.continent,
        summary: d.summary,
        highlights: d.highlights,
        bestTimeToVisit: d.bestTimeToVisit,
        videoCount: ctx.catalog.byDestination.get(d.id)?.length ?? 0,
        hasGuide: Boolean(d.guideProductId),
        rentalCount: ctx.data.products.filter(
          (p) => p.type === 'rental' && p.destinationIds.includes(d.id),
        ).length,
      }));

      return toolResult({
        ok: true,
        total: filtered.length,
        filter: {
          region: args.region,
          country: args.country,
          continent: args.continent,
        },
        destinations,
        nextSteps: [
          {
            label: 'Get a full overview for one destination',
            tool: 'get_destination_overview',
            description: 'Pass a destination id or name.',
          },
          {
            label: 'Book a consultation to plan a trip',
            tool: 'get_service_details',
            args: { serviceId: 'consultation' },
          },
          {
            label: 'Browse destination guides',
            tool: 'list_products',
            args: { type: 'guide' },
          },
        ],
      });
    },
  });
}
