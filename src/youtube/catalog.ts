import type { Destination } from '../data/schemas.js';
import { listPlaylistVideoIds } from './playlist.js';
import { getVideosByIds } from './videos.js';
import type { CatalogVideo, VideoDetails } from './types.js';
import { logger } from '../logger.js';

export interface Catalog {
  videos: CatalogVideo[];
  byId: Map<string, CatalogVideo>;
  byDestination: Map<string, CatalogVideo[]>;
  generatedAt: string;
}

/** Returns an empty catalog. Used as the initial value before lazy hydration. */
export function emptyCatalog(): Catalog {
  return {
    videos: [],
    byId: new Map(),
    byDestination: new Map(),
    generatedAt: new Date(0).toISOString(),
  };
}

interface PerDestinationResult {
  destinationId: string;
  playlistId: string;
  videos: VideoDetails[];
}

async function hydrateOne(dest: Destination): Promise<PerDestinationResult | null> {
  let videoIds: string[];
  try {
    videoIds = dest.videoIds?.length
      ? dest.videoIds
      : await listPlaylistVideoIds(dest.playlistId);
  } catch (err) {
    logger.error(
      { destination: dest.id, playlistId: dest.playlistId, err: (err as Error).message },
      'failed to fetch playlist; skipping destination',
    );
    return null;
  }

  let videos: VideoDetails[];
  try {
    videos = await getVideosByIds(videoIds);
  } catch (err) {
    logger.error(
      { destination: dest.id, err: (err as Error).message },
      'failed to hydrate videos; skipping destination',
    );
    return null;
  }

  return { destinationId: dest.id, playlistId: dest.playlistId, videos };
}

export async function buildCatalog(destinations: Destination[]): Promise<Catalog> {
  const byId = new Map<string, CatalogVideo>();
  const byDestination = new Map<string, CatalogVideo[]>();
  for (const dest of destinations) {
    byDestination.set(dest.id, []);
  }

  // Fetch every destination's playlist in parallel. With 25 destinations this
  // brings cold-start catalog hydration from ~25s (sequential) down to ~2s,
  // which is critical for serverless deploys (Vercel, Lambda, etc.).
  const results = await Promise.all(destinations.map((dest) => hydrateOne(dest)));

  for (const result of results) {
    if (!result) continue;
    const bucket = byDestination.get(result.destinationId)!;
    for (const d of result.videos) {
      const existing = byId.get(d.videoId);
      if (existing) {
        if (!existing.sourceDestinationIds.includes(result.destinationId)) {
          existing.sourceDestinationIds.push(result.destinationId);
        }
        if (!existing.sourcePlaylistIds.includes(result.playlistId)) {
          existing.sourcePlaylistIds.push(result.playlistId);
        }
        bucket.push(existing);
      } else {
        const catalogVideo: CatalogVideo = {
          ...d,
          sourceDestinationIds: [result.destinationId],
          sourcePlaylistIds: [result.playlistId],
        };
        byId.set(d.videoId, catalogVideo);
        bucket.push(catalogVideo);
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
