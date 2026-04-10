import { google, youtube_v3 } from 'googleapis';
import { getConfig } from '../config.js';

let cached: youtube_v3.Youtube | undefined;

export function getYoutubeClient(): youtube_v3.Youtube {
  if (!cached) {
    const config = getConfig();
    cached = google.youtube({
      version: 'v3',
      auth: config.YOUTUBE_API_KEY,
    });
  }
  return cached;
}

export function resetYoutubeClientForTests(client?: youtube_v3.Youtube): void {
  cached = client;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { code?: number; status?: number }).code ?? (err as { status?: number }).status;
      const isRetryable = status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
      if (!isRetryable || attempt === retries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
