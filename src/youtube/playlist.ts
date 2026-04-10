import { getYoutubeClient, withRetry } from './client.js';
import type { PlaylistInfo } from './types.js';

export async function listPlaylistVideoIds(playlistId: string): Promise<string[]> {
  const yt = getYoutubeClient();
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await withRetry(() =>
      yt.playlistItems.list({
        part: ['contentDetails'],
        playlistId,
        maxResults: 50,
        pageToken,
      }),
    );

    for (const item of res.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) videoIds.push(vid);
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return videoIds;
}

export async function getPlaylistInfo(playlistId: string): Promise<PlaylistInfo | null> {
  const yt = getYoutubeClient();
  const res = await withRetry(() =>
    yt.playlists.list({
      part: ['snippet', 'contentDetails'],
      id: [playlistId],
      maxResults: 1,
    }),
  );

  const item = res.data.items?.[0];
  if (!item) return null;

  return {
    playlistId,
    title: item.snippet?.title ?? '',
    description: item.snippet?.description ?? '',
    channelTitle: item.snippet?.channelTitle ?? '',
    itemCount: item.contentDetails?.itemCount ?? 0,
  };
}
