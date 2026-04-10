import type { CatalogVideo } from '../youtube/types.js';

export interface SearchOptions {
  query: string;
  destinationId?: string;
  limit?: number;
  publishedAfter?: string;
  publishedBefore?: string;
}

export interface VideoSearchResult {
  video: CatalogVideo;
  score: number;
  snippets: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreMatch(video: CatalogVideo, tokens: string[]): { score: number; snippets: string[] } {
  const title = video.title.toLowerCase();
  const desc = video.description.toLowerCase();
  const tags = (video.tags ?? []).join(' ').toLowerCase();

  let score = 0;
  const snippets: string[] = [];
  for (const t of tokens) {
    if (!t) continue;
    let hitCount = 0;
    if (title.includes(t)) {
      score += 5;
      hitCount++;
    }
    if (tags.includes(t)) {
      score += 3;
      hitCount++;
    }
    if (desc.includes(t)) {
      score += 1;
      hitCount++;
      // Add a snippet around the first occurrence
      const idx = desc.indexOf(t);
      const start = Math.max(0, idx - 40);
      const end = Math.min(desc.length, idx + 60);
      const snippet = video.description.substring(start, end).replace(/\s+/g, ' ').trim();
      if (snippet && !snippets.includes(snippet)) {
        snippets.push(snippet);
      }
    }
    if (hitCount === 0) {
      // Missing token → downweight
      score -= 1;
    }
  }
  return { score, snippets };
}

export function searchVideos(
  videos: CatalogVideo[],
  options: SearchOptions,
): VideoSearchResult[] {
  const tokens = tokenize(options.query);
  if (tokens.length === 0) return [];

  let candidates = videos;

  if (options.destinationId) {
    candidates = candidates.filter((v) => v.sourceDestinationIds.includes(options.destinationId!));
  }

  if (options.publishedAfter) {
    const after = new Date(options.publishedAfter).getTime();
    candidates = candidates.filter((v) => new Date(v.publishedAt).getTime() >= after);
  }

  if (options.publishedBefore) {
    const before = new Date(options.publishedBefore).getTime();
    candidates = candidates.filter((v) => new Date(v.publishedAt).getTime() <= before);
  }

  const scored: VideoSearchResult[] = [];
  for (const video of candidates) {
    const { score, snippets } = scoreMatch(video, tokens);
    if (score > 0) {
      scored.push({ video, score, snippets: snippets.slice(0, 3) });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.limit ?? 10);
}
