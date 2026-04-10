import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { startLeadInput } from './schemas.js';
import { toolResult } from './response.js';
import { createLead } from '../services/leads.js';
import { registerTool } from './registrar.js';

export function registerStartLead(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'start_lead',
    title: 'Capture a visitor lead for Zoe',
    description:
      'Capture a visitor\'s contact info and interest — use this when a user asks to be contacted, wants to book a service, or is ready to buy a guide/rental. Sends an email to Zoe via Resend and returns a PayPal payment link (when a serviceId is passed) plus a Crisp chat link. Always use the real email the user provides; never invent contact info.',
    inputSchema: startLeadInput,
    handler: async (args) => {
      const result = await createLead(
        {
          leadType: args.leadType,
          name: args.name,
          email: args.email,
          message: args.message,
          destinationId: args.destinationId,
          serviceId: args.serviceId,
          productId: args.productId,
        },
        ctx.data,
      );

      const nextSteps: Array<{ label: string; url?: string; tool?: string; args?: Record<string, unknown>; description?: string }> = [];
      if (result.paypalLink) {
        nextSteps.push({
          label: 'Complete payment via PayPal',
          url: result.paypalLink,
        });
      }
      if (result.crispLink) {
        nextSteps.push({
          label: 'Message Zoe on Crisp',
          url: result.crispLink,
        });
      }
      nextSteps.push({
        label: 'Explore more destinations while you wait',
        tool: 'list_destinations',
        args: {},
      });

      return toolResult({
        ok: true,
        leadId: result.leadId,
        status: result.status,
        paypalLink: result.paypalLink,
        crispLink: result.crispLink,
        nextSteps,
      });
    },
  });
}
