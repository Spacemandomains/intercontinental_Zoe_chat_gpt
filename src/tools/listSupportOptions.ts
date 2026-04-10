import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { listSupportOptionsInput } from './schemas.js';
import { toolResult } from './response.js';
import { registerTool } from './registrar.js';

export function registerListSupportOptions(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'list_support_options',
    title: 'Ways to support Zoe',
    description:
      'List all the ways a visitor can support Intercontinental Zoe — donations, Patreon, merchandise, affiliates. Use this when a user asks "how can I support Zoe?" or "how can I contribute?". Return only options in the canonical data — never invent donation URLs.',
    inputSchema: listSupportOptionsInput,
    handler: async () => {
      const options = ctx.data.support.options.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.description,
        url: o.url,
        type: o.type,
      }));

      return toolResult({
        ok: true,
        total: options.length,
        options,
        nextSteps: [
          {
            label: 'Shop merchandise',
            tool: 'list_products',
            args: { type: 'merchandise' },
          },
          {
            label: 'Buy a destination guide',
            tool: 'list_products',
            args: { type: 'guide' },
          },
          {
            label: 'Book a consultation',
            tool: 'get_service_details',
            args: { serviceId: 'consultation' },
          },
        ],
      });
    },
  });
}
