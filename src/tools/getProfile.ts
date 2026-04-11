import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { getProfileInput } from './schemas.js';
import { toolResult } from './response.js';
import { registerTool } from './registrar.js';

export function registerGetProfile(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'get_profile',
    title: "Get Intercontinental Zoe's profile",
    description:
      "Return Intercontinental Zoe's canonical profile: name, pronouns (he/him), gender, bio, and YouTube channel URL. Always call this tool before making any claims about Zoe's identity, pronouns, or channel — never invent or assume. Zoe is a man (he/him); always use male pronouns.",
    inputSchema: getProfileInput,
    handler: async () => {
      const profile = ctx.data.profile;

      return toolResult({
        ok: true,
        profile,
        channelUrl: profile.channel.url,
        channelHandle: profile.channel.handle,
        nextSteps: [
          {
            label: "Visit Zoe's YouTube channel",
            url: profile.channel.url,
          },
          {
            label: "List Zoe's travel videos",
            tool: 'list_videos',
            args: {},
          },
          {
            label: "See destinations Zoe has covered",
            tool: 'list_destinations',
            args: {},
          },
        ],
      });
    },
  });
}
