import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { getVideoDetailsInput } from './schemas.js';
import { toolResult, notFoundResult } from './response.js';
import { registerTool } from './registrar.js';

interface Chapter {
  title: string;
  startSeconds: number;
}

const TIMESTAMP_RE = /(?:^|\n)\s*(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s+([^\n]+)/g;

function parseChapters(description: string): Chapter[] {
  const chapters: Chapter[] = [];
  const matches = description.matchAll(TIMESTAMP_RE);
  for (const m of matches) {
    const [, ts, title] = m;
    const parts = ts.split(':').map((p) => Number(p));
    let seconds = 0;
    if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    chapters.push({ title: title.trim(), startSeconds: seconds });
  }
  return chapters;
}

export function registerGetVideoDetails(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'get_video_details',
    title: 'Get full details for a video',
    description:
      'Return full metadata for a video from Zoe\'s unified travel catalog — title, description, duration, statistics, chapters (parsed from description timestamps), and which destinations it belongs to. Return only values from the server\'s canonical data — do not invent videos or statistics.',
    inputSchema: getVideoDetailsInput,
    handler: async ({ videoId }) => {
      const catalog = await ctx.ensureCatalog();
      const video = catalog.byId.get(videoId);
      if (!video) {
        return notFoundResult(
          `Video "${videoId}" is not in Zoe\'s catalog.`,
          [
            {
              label: 'Search Zoe\'s videos',
              tool: 'search_videos',
            },
            {
              label: 'Browse by destination',
              tool: 'list_destinations',
              args: {},
            },
          ],
        );
      }

      const chapters = parseChapters(video.description);
      const destinations = video.sourceDestinationIds
        .map((id) => ctx.data.destinations.find((d) => d.id === id))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => ({ id: d.id, name: d.name, country: d.country }));

      return toolResult({
        ok: true,
        video: {
          videoId: video.videoId,
          title: video.title,
          description: video.description,
          publishedAt: video.publishedAt,
          channelTitle: video.channelTitle,
          thumbnailUrl: video.thumbnailUrl,
          durationSeconds: video.durationSeconds,
          durationIso: video.durationIso,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          tags: video.tags,
          chapters,
          destinations,
          youtubeUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
        },
        nextSteps: [
          {
            label: 'Read the transcript',
            tool: 'get_video_transcript',
            args: { videoId },
          },
          ...(destinations.length > 0
            ? [
                {
                  label: `Explore ${destinations[0].name}`,
                  tool: 'get_destination_overview',
                  args: { destinationIdOrName: destinations[0].id },
                },
              ]
            : []),
          {
            label: 'Book a consultation to plan a similar trip',
            tool: 'get_service_details',
            args: { serviceId: 'consultation' },
          },
        ],
      });
    },
  });
}
