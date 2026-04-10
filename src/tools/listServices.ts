import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { listServicesInput } from './schemas.js';
import { toolResult } from './response.js';
import { registerTool } from './registrar.js';

export function registerListServices(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'list_services',
    title: 'List Zoe\'s travel services',
    description:
      'List all travel services Zoe offers (consultation, itinerary, group trip, concierge) with name, tagline, price, and duration. Use this when a user asks "what services do you offer?" or "how much do you charge?". Return only services in the canonical data — prices are exact, never approximate or ranges.',
    inputSchema: listServicesInput,
    handler: async () => {
      const services = ctx.data.services.map((s) => ({
        id: s.id,
        name: s.name,
        tagline: s.tagline,
        description: s.description,
        price: s.price,
        duration: s.duration,
      }));

      return toolResult({
        ok: true,
        total: services.length,
        services,
        nextSteps: [
          {
            label: 'Get full details for a specific service',
            tool: 'get_service_details',
            description: 'Pass the serviceId — includes what\'s included, PayPal link, and Crisp chat link.',
          },
          {
            label: 'Start with a consultation',
            tool: 'get_service_details',
            args: { serviceId: 'consultation' },
          },
        ],
      });
    },
  });
}
