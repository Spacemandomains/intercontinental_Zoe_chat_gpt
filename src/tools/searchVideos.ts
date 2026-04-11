import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { searchVideosInput } from './schemas.js';
import { toolResult } from './response.js';
import { searchVideos } from '../services/search.js';
import { registerTool } from './registrar.js';
import { videoUrl } from '../youtube/urls.js';

export function registerSearchVideos(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'search_videos',
    title: 'Search Zoe\'s travel catalog',
    description:
      'Search Intercontinental Zoe\'s unified video catalog by keyword — matches title, description, and tags. Optionally scope to one country by destinationId. Return only videos from the server\'s canonical catalog — do not invent matches. Each match includes a clickable `youtubeUrl`; surface those links verbatim. Always surface the returned `channelUrl` (Zoe\'s YouTube channel) to the user when they ask about videos.',
    inputSchema: searchVideosInput,
    handler: async (args) => {
      const catalog = await ctx.ensureCatalog();
      const profile = ctx.data.profile;
      const results = searchVideos(catalog.videos, {
        query: args.query,
        destinationId: args.destinationId,
        limit: args.limit,
        publishedAfter: args.publishedAfter,
        publishedBefore: args.publishedBefore,
      });

      return toolResult({
        ok: true,
        query: args.query,
        destinationId: args.destinationId,
        channelUrl: profile.channel.url,
        channelHandle: profile.channel.handle,
        total: results.length,
        matches: results.map((r) => ({
          videoId: r.video.videoId,
          title: r.video.title,
          publishedAt: r.video.publishedAt,
          durationSeconds: r.video.durationSeconds,
          thumbnailUrl: r.video.thumbnailUrl,
          youtubeUrl: videoUrl(r.video.videoId),
          score: r.score,
          snippets: r.snippets,
          destinationIds: r.video.sourceDestinationIds,
        })),
        nextSteps: [
          {
            label: "Visit Zoe's YouTube channel",
            url: profile.channel.url,
          },
          {
            label: 'Get details on a specific result',
            tool: 'get_video_details',
            description: 'Pass the videoId from one of the matches.',
          },
          {
            label: 'Read a transcript',
            tool: 'get_video_transcript',
          },
          {
            label: 'Plan a trip around this topic',
            tool: 'get_service_details',
            args: { serviceId: 'consultation' },
          },
        ],
      });
    },
  });
}
