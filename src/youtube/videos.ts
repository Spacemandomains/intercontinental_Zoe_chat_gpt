import { getYoutubeClient, withRetry } from './client.js';
import type { VideoDetails } from './types.js';

const ISO_DURATION_RE = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

export function parseIsoDurationSeconds(iso: string): number {
  const match = ISO_DURATION_RE.exec(iso);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(s ?? 0);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function getVideosByIds(videoIds: string[]): Promise<VideoDetails[]> {
  if (videoIds.length === 0) return [];
  const yt = getYoutubeClient();
  const results: VideoDetails[] = [];

  for (const batch of chunk(videoIds, 50)) {
    const res = await withRetry(() =>
      yt.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: batch,
        maxResults: 50,
      }),
    );

    for (const item of res.data.items ?? []) {
      if (!item.id) continue;
      const snippet = item.snippet ?? {};
      const contentDetails = item.contentDetails ?? {};
      const statistics = item.statistics ?? {};
      const thumbnails = snippet.thumbnails ?? {};
      const thumbnailUrl =
        thumbnails.maxres?.url ??
        thumbnails.high?.url ??
        thumbnails.medium?.url ??
        thumbnails.default?.url ??
        '';

      results.push({
        videoId: item.id,
        title: snippet.title ?? '',
        description: snippet.description ?? '',
        publishedAt: snippet.publishedAt ?? '',
        channelTitle: snippet.channelTitle ?? '',
        thumbnailUrl,
        durationIso: contentDetails.duration ?? 'PT0S',
        durationSeconds: parseIsoDurationSeconds(contentDetails.duration ?? 'PT0S'),
        viewCount: statistics.viewCount ? Number(statistics.viewCount) : undefined,
        likeCount: statistics.likeCount ? Number(statistics.likeCount) : undefined,
        commentCount: statistics.commentCount ? Number(statistics.commentCount) : undefined,
        tags: snippet.tags ?? undefined,
      });
    }
  }

  return results;
}
