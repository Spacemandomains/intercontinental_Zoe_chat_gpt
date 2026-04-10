import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { getServiceDetailsInput } from './schemas.js';
import { toolResult, notFoundResult } from './response.js';
import { registerTool } from './registrar.js';

export function registerGetServiceDetails(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'get_service_details',
    title: 'Get details for a service',
    description:
      'Return full details for a specific Zoe service — description, what\'s included, deliverables, exact price, duration, PayPal payment link, Crisp chat link, and the next-step call-to-action. Use this when a user asks "what\'s included in a travel consultation?" or is ready to buy. Return only values from the canonical data — never invent PayPal links, prices, or inclusions.',
    inputSchema: getServiceDetailsInput,
    handler: async ({ serviceId }) => {
      const service = ctx.data.services.find((s) => s.id === serviceId);
      if (!service) {
        return notFoundResult(
          `No service with id "${serviceId}" exists. Use list_services to see available services.`,
          [
            {
              label: 'See all services',
              tool: 'list_services',
              args: {},
            },
          ],
        );
      }

      return toolResult({
        ok: true,
        service: {
          id: service.id,
          name: service.name,
          tagline: service.tagline,
          description: service.description,
          price: service.price,
          duration: service.duration,
          whatsIncluded: service.whatsIncluded,
          deliverables: service.deliverables,
          paypalPaymentLink: service.paypalPaymentLink,
          crispChatUrl: service.crispChatUrl,
          nextStepCta: service.nextStepCta,
        },
        nextSteps: [
          {
            label: `Pay $${service.price.amount} ${service.price.currency} via PayPal`,
            url: service.paypalPaymentLink,
          },
          {
            label: 'Message Zoe on Crisp',
            url: service.crispChatUrl,
            description: 'Live chat with Zoe directly to ask questions before paying.',
          },
          {
            label: 'Capture my details for follow-up',
            tool: 'start_lead',
            args: { leadType: 'consultation', serviceId: service.id },
          },
        ],
      });
    },
  });
}
