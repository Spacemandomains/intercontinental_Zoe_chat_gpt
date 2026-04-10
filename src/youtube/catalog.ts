import type { Destination } from '../data/schemas.js';
import { listPlaylistVideoIds } from './playlist.js';
import { getVideosByIds } from './videos.js';
import type { CatalogVideo } from './types.js';
import { logger } from '../logger.js';

export interface Catalog {
  videos: CatalogVideo[];
  byId: Map<string, CatalogVideo>;
  byDestination: Map<string, CatalogVideo[]>;
  generatedAt: string;
}

export async function buildCatalog(destinations: Destination[]): Promise<Catalog> {
  const byId = new Map<string, CatalogVideo>();
  const byDestination = new Map<string, CatalogVideo[]>();

  for (const dest of destinations) {
    byDestination.set(dest.id, []);
    let videoIds: string[];
    try {
      // Respect explicit overrides; otherwise fetch the playlist.
      videoIds = dest.videoIds?.length
        ? dest.videoIds
        : await listPlaylistVideoIds(dest.playlistId);
    } catch (err) {
      logger.error(
        { destination: dest.id, playlistId: dest.playlistId, err: (err as Error).message },
        'failed to fetch playlist; skipping destination',
      );
      continue;
    }

    let details;
    try {
      details = await getVideosByIds(videoIds);
    } catch (err) {
      logger.error(
        { destination: dest.id, err: (err as Error).message },
        'failed to hydrate videos; skipping destination',
      );
      continue;
    }

    for (const d of details) {
      const existing = byId.get(d.videoId);
      if (existing) {
        if (!existing.sourceDestinationIds.includes(dest.id)) {
          existing.sourceDestinationIds.push(dest.id);
        }
        if (!existing.sourcePlaylistIds.includes(dest.playlistId)) {
          existing.sourcePlaylistIds.push(dest.playlistId);
        }
        byDestination.get(dest.id)!.push(existing);
      } else {
        const catalogVideo: CatalogVideo = {
          ...d,
          sourceDestinationIds: [dest.id],
          sourcePlaylistIds: [dest.playlistId],
        };
        byId.set(d.videoId, catalogVideo);
        byDestination.get(dest.id)!.push(catalogVideo);
      }
    }
  }

  const videos = Array.from(byId.values());
  return {
    videos,
    byId,
    byDestination,
    generatedAt: new Date().toISOString(),
  };
}
