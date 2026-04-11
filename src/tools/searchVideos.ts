import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { searchVideosInput } from './schemas.js';
import { toolResult } from './response.js';
import { searchVideos } from '../services/search.js';
import { registerTool } from './registrar.js';
import { playlistUrl, videoUrl } from '../youtube/urls.js';

export function registerSearchVideos(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'search_videos',
    title: "Search International Zoe's travel catalog",
    description:
      'Search International Zoe\'s unified video catalog by EXPLICIT KEYWORD only — matches title, description, and tags. The catalog is drawn from the International Zoe YouTube channel (@INTERNATIONALZOE); "International Zoe" is the canonical catalog keyword and returns the full catalog. Use this tool ONLY when the user has given a concrete search term (e.g., "International Zoe", "food", "street photography", "Medellin rooftop"). For generic "show me videos", "what have you filmed", "videos from places you\'ve been", or "recent videos" requests, call list_videos instead — NEVER fabricate an unrelated search query, and never search for "Intercontinental Zoe" (the channel is named International Zoe, not Intercontinental Zoe). Optionally scope to one country by destinationId. Return only videos from the server\'s canonical catalog — do not invent matches. Each match includes a clickable `youtubeUrl`; surface those links verbatim. When destinationId is passed, the response also includes a top-level `playlistUrl` for the full per-country YouTube playlist — always share it alongside the individual matches. When destinationId is not passed, the response includes a `playlists` array naming the destinations the matches came from, each with its own `playlistUrl` — offer those to the user. Always surface the returned `channelUrl` (https://www.youtube.com/@INTERNATIONALZOE).',
    inputSchema: searchVideosInput,
    handler: async (args) => {
      const catalog = await ctx.ensureCatalog();
      const profile = ctx.data.profile;

      // Resolve a single scoped destination (mirrors list_videos) so we can
      // surface its full per-country playlist at the top level alongside matches.
      let scopedDestination: { id: string; name: string; playlistId: string } | null = null;
      if (args.destinationId) {
        const dest = ctx.data.destinations.find((d) => d.id === args.destinationId);
        if (dest) {
          scopedDestination = { id: dest.id, name: dest.name, playlistId: dest.playlistId };
        }
      }

      const results = searchVideos(catalog.videos, {
        query: args.query,
        destinationId: args.destinationId,
        limit: args.limit,
        publishedAfter: args.publishedAfter,
        publishedBefore: args.publishedBefore,
      });

      const scopedPlaylistUrl = scopedDestination ? playlistUrl(scopedDestination.playlistId) : null;

      // When the caller did not scope by destinationId, derive the set of
      // playlists implied by the match set: dedupe the destinations that
      // appear in matched videos, rank them by number of matches, cap at 5,
      // and join against canonical data for {destinationId, name, playlistUrl}.
      // Lets the GPT offer the per-country playlist links alongside the hits.
      const playlistsFromMatches: { destinationId: string; name: string; playlistUrl: string }[] = [];
      if (!scopedDestination && results.length > 0) {
        const counts = new Map<string, number>();
        for (const r of results) {
          for (const destId of r.video.sourceDestinationIds) {
            counts.set(destId, (counts.get(destId) ?? 0) + 1);
          }
        }
        const ranked = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        for (const [destId] of ranked) {
          const dest = ctx.data.destinations.find((d) => d.id === destId);
          if (dest) {
            playlistsFromMatches.push({
              destinationId: dest.id,
              name: dest.name,
              playlistUrl: playlistUrl(dest.playlistId),
            });
          }
        }
      }

      return toolResult({
        ok: true,
        query: args.query,
        destinationId: args.destinationId,
        channelUrl: profile.channel.url,
        channelHandle: profile.channel.handle,
        playlistId: scopedDestination?.playlistId ?? null,
        playlistUrl: scopedPlaylistUrl,
        playlists: scopedDestination
          ? [
              {
                destinationId: scopedDestination.id,
                name: scopedDestination.name,
                playlistUrl: scopedPlaylistUrl!,
              },
            ]
          : playlistsFromMatches,
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
          ...(scopedDestination && scopedPlaylistUrl
            ? [
                {
                  label: `Watch Zoe's full ${scopedDestination.name} playlist on YouTube`,
                  url: scopedPlaylistUrl,
                },
              ]
            : []),
          {
            label: "Visit International Zoe's YouTube channel",
            url: profile.channel.url,
          },
          {
            label: 'Browse all videos without a keyword',
            tool: 'list_videos',
            description:
              'For a generic "show me videos" request, call list_videos instead of search_videos.',
          },
          {
            label: 'See every destination and its playlist URL',
            tool: 'list_destinations',
            args: {},
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
