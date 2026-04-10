import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from '../tools/types.js';

export const GUIDANCE_URI = 'guidance://system';

export function registerGuidanceResource(server: McpServer, ctx: ToolContext): void {
  server.registerResource(
    'guidance',
    GUIDANCE_URI,
    {
      title: 'System guidance for Zoe MCP server',
      description:
        'Ground rules for the LLM using this MCP server — anti-hallucination guardrails, conversational style, and the sales funnel priorities. Load this at the start of every conversation to stay on-rails.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: ctx.data.guidance,
        },
      ],
    }),
  );
}
