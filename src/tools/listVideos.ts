import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import type { CatalogVideo } from '../youtube/types.js';
import { listVideosInput } from './schemas.js';
import { toolResult, notFoundResult } from './response.js';
import { registerTool } from './registrar.js';

function sortVideos(videos: CatalogVideo[], sort: 'newest' | 'oldest' | 'longest' | 'shortest'): CatalogVideo[] {
  const copy = videos.slice();
  switch (sort) {
    case 'newest':
      copy.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      break;
    case 'oldest':
      copy.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
      break;
    case 'longest':
      copy.sort((a, b) => b.durationSeconds - a.durationSeconds);
      break;
    case 'shortest':
      copy.sort((a, b) => a.durationSeconds - b.durationSeconds);
      break;
  }
  return copy;
}

function summarize(v: CatalogVideo) {
  return {
    videoId: v.videoId,
    title: v.title,
    publishedAt: v.publishedAt,
    durationSeconds: v.durationSeconds,
    thumbnailUrl: v.thumbnailUrl,
    destinationIds: v.sourceDestinationIds,
  };
}

export function registerListVideos(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'list_videos',
    title: "List Zoe's travel videos",
    description:
      "List videos from Intercontinental Zoe's unified travel catalog across all per-country playlists. Use destinationId to scope to a single country. Return only values from the server's canonical data — do not invent videos. Always surface the returned `channelUrl` (Zoe's YouTube channel) to the user when they ask about videos.",
    inputSchema: listVideosInput,
    handler: async (args) => {
      const catalog = await ctx.ensureCatalog();
      const profile = ctx.data.profile;
      let pool = catalog.videos;
      if (args.destinationId) {
        const bucket = catalog.byDestination.get(args.destinationId);
        if (!bucket) {
          return notFoundResult(
            `No destination with id "${args.destinationId}" is loaded in the canonical data.`,
            [
              {
                label: 'See all destinations',
                tool: 'list_destinations',
                args: {},
              },
            ],
          );
        }
        pool = bucket;
      }

      const sorted = sortVideos(pool, args.sort);
      const page = sorted.slice(args.offset, args.offset + args.limit);

      return toolResult({
        ok: true,
        total: sorted.length,
        offset: args.offset,
        limit: args.limit,
        sort: args.sort,
        destinationId: args.destinationId,
        channelUrl: profile.channel.url,
        channelHandle: profile.channel.handle,
        items: page.map(summarize),
        nextSteps: [
          {
            label: "Visit Zoe's YouTube channel",
            url: profile.channel.url,
          },
          {
            label: 'Get details for one of these videos',
            tool: 'get_video_details',
            description: 'Pass the videoId of the result you want more information about.',
          },
          {
            label: 'Search across all videos',
            tool: 'search_videos',
          },
          {
            label: 'See what destinations Zoe covers',
            tool: 'list_destinations',
            args: {},
          },
        ],
      });
    },
  });
}
