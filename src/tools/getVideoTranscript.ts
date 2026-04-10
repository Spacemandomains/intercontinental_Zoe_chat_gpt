import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './types.js';
import { getVideoTranscriptInput } from './schemas.js';
import { toolResult, notFoundResult } from './response.js';
import { getTranscript } from '../youtube/transcripts.js';
import { createCache, wrap } from '../cache.js';
import { getConfig } from '../config.js';
import type { VideoTranscript } from '../youtube/types.js';
import { logger } from '../logger.js';
import { registerTool } from './registrar.js';

const transcriptCache = createCache<VideoTranscript>({
  ttl: getConfig().CACHE_TTL_TRANSCRIPT_MS,
  max: 500,
});

export function registerGetVideoTranscript(server: McpServer, ctx: ToolContext): void {
  registerTool(server, ctx, {
    name: 'get_video_transcript',
    title: 'Fetch a video transcript',
    description:
      'Return the public caption transcript for a video in Zoe\'s catalog — returns both timestamped segments and a full-text version. Captions come from YouTube\'s public track; if none are available, returns notFound. Never invent transcript text.',
    inputSchema: getVideoTranscriptInput,
    handler: async ({ videoId, language }) => {
      const video = ctx.catalog.byId.get(videoId);
      if (!video) {
        return notFoundResult(
          `Video "${videoId}" is not in Zoe\'s catalog.`,
          [
            { label: 'Search videos', tool: 'search_videos' },
            { label: 'Browse destinations', tool: 'list_destinations', args: {} },
          ],
        );
      }

      const lang = language ?? getConfig().DEFAULT_TRANSCRIPT_LANG;
      const cacheKey = `${videoId}:${lang}`;

      let transcript: VideoTranscript;
      try {
        transcript = await wrap(transcriptCache, cacheKey, () => getTranscript(videoId, lang));
      } catch (err) {
        logger.warn({ videoId, lang, err: (err as Error).message }, 'transcript fetch failed');
        return notFoundResult(
          `No public transcript available for "${video.title}" in ${lang}. The video may not have captions.`,
          [
            {
              label: 'Watch on YouTube',
              url: `https://www.youtube.com/watch?v=${videoId}`,
            },
            {
              label: 'Get the video details instead',
              tool: 'get_video_details',
              args: { videoId },
            },
          ],
        );
      }

      return toolResult({
        ok: true,
        videoId: transcript.videoId,
        language: transcript.language,
        segmentCount: transcript.segments.length,
        segments: transcript.segments,
        fullText: transcript.fullText,
        nextSteps: [
          {
            label: 'Get the destination overview',
            tool: 'get_destination_overview',
            args: video.sourceDestinationIds[0]
              ? { destinationIdOrName: video.sourceDestinationIds[0] }
              : undefined,
          },
          {
            label: 'Book a consultation for this destination',
            tool: 'get_service_details',
            args: { serviceId: 'consultation' },
          },
        ],
      });
    },
  });
}
