import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { listProductsInput } from './schemas.js';
import { toolResult } from './response.js';
import { findDestination } from '../services/destinations.js';
import { registerTool } from './registrar.js';

export function registerListProducts(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'list_products',
    title: 'List products, rentals, and guides',
    description:
      'List products Zoe offers — type is one of "guide", "rental", or "merchandise". Optionally filter rentals and guides by destination (id or country name). Covers "how much are the destination guides?" and "what rentals are available in the Philippines?". Return only products in the canonical data — never invent Shopify URLs, Airbnb listings, or prices.',
    inputSchema: listProductsInput,
    handler: async (args) => {
      let destinationId: string | undefined;
      if (args.destination) {
        const dest = findDestination(ctx.data.destinations, args.destination);
        destinationId = dest?.id;
      }

      let pool = ctx.data.products.slice();
      if (args.type) {
        pool = pool.filter((p) => p.type === args.type);
      }
      if (destinationId) {
        pool = pool.filter((p) => p.destinationIds.includes(destinationId!));
      }

      const products = pool.slice(0, args.limit).map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        description: p.description,
        price: p.price,
        url: p.url,
        platform: p.platform,
        destinationIds: p.destinationIds,
        imageUrl: p.imageUrl,
      }));

      const nextSteps: Array<{ label: string; tool?: string; args?: Record<string, unknown>; url?: string; description?: string }> = [];
      if (args.type === 'rental' || !args.type) {
        nextSteps.push({
          label: 'Book a consultation to help choose a rental',
          tool: 'get_service_details',
          args: { serviceId: 'consultation' },
        });
      }
      if (args.type === 'guide' || !args.type) {
        nextSteps.push({
          label: 'See all destinations (each has a guide if available)',
          tool: 'list_destinations',
          args: {},
        });
      }
      nextSteps.push({
        label: 'Ways to support Zoe',
        tool: 'list_support_options',
        args: {},
      });

      return toolResult({
        ok: true,
        filter: {
          type: args.type,
          destination: args.destination,
          resolvedDestinationId: destinationId,
        },
        total: pool.length,
        products,
        nextSteps,
      });
    },
  });
}
