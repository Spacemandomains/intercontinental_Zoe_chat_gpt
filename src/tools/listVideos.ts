import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import type { CatalogVideo } from '../youtube/types.js';
import { listVideosInput } from './schemas.js';
import { toolResult, notFoundResult } from './response.js';
import { registerTool } from './registrar.js';
import { playlistUrl, videoUrl } from '../youtube/urls.js';

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
    youtubeUrl: videoUrl(v.videoId),
    destinationIds: v.sourceDestinationIds,
  };
}

export function registerListVideos(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'list_videos',
    title: "List Zoe's travel videos",
    description:
      "List videos from Intercontinental Zoe's unified travel catalog across all per-country playlists. Use destinationId to scope to a single country. Return only values from the server's canonical data — do not invent videos. Each item in the response includes a clickable `youtubeUrl`; surface those links verbatim to the user. When a destinationId is passed, the response also includes a top-level `playlistUrl` pointing at the full per-country YouTube playlist — always share that link alongside the individual videos.",
    inputSchema: listVideosInput,
    handler: async (args) => {
      const catalog = await ctx.ensureCatalog();
      const profile = ctx.data.profile;
      let pool = catalog.videos;
      let scopedDestination: { id: string; name: string; playlistId: string } | null = null;
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
        const destination = ctx.data.destinations.find((d) => d.id === args.destinationId);
        if (destination) {
          scopedDestination = {
            id: destination.id,
            name: destination.name,
            playlistId: destination.playlistId,
          };
        }
      }

      const sorted = sortVideos(pool, args.sort);
      const page = sorted.slice(args.offset, args.offset + args.limit);

      const scopedPlaylistUrl = scopedDestination ? playlistUrl(scopedDestination.playlistId) : null;

      return toolResult({
        ok: true,
        total: sorted.length,
        offset: args.offset,
        limit: args.limit,
        sort: args.sort,
        destinationId: args.destinationId,
        channelUrl: profile.channel.url,
        channelHandle: profile.channel.handle,
        playlistId: scopedDestination?.playlistId ?? null,
        playlistUrl: scopedPlaylistUrl,
        items: page.map(summarize),
        nextSteps: [
          ...(scopedDestination && scopedPlaylistUrl
            ? [
                {
                  label: `Watch Zoe's full ${scopedDestination.name} playlist on YouTube`,
                  url: scopedPlaylistUrl,
                },
              ]
            : []),
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
