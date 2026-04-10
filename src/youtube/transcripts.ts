import { Innertube } from 'youtubei.js';
import type { VideoTranscript, TranscriptSegment } from './types.js';

let innertubePromise: Promise<Innertube> | undefined;

function getInnertube(): Promise<Innertube> {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({ generate_session_locally: true });
  }
  return innertubePromise;
}

export function resetInnertubeForTests(instance?: Innertube): void {
  innertubePromise = instance ? Promise.resolve(instance) : undefined;
}

interface TranscriptSegmentLike {
  start_ms?: string | number;
  end_ms?: string | number;
  snippet?: { text?: string } | { runs?: Array<{ text?: string }> };
}

function extractSegmentText(snippet: TranscriptSegmentLike['snippet']): string {
  if (!snippet) return '';
  if ('text' in snippet && typeof snippet.text === 'string') return snippet.text;
  if ('runs' in snippet && Array.isArray(snippet.runs)) {
    return snippet.runs.map((r) => r.text ?? '').join('');
  }
  return '';
}

export async function getTranscript(
  videoId: string,
  language = 'en',
): Promise<VideoTranscript> {
  const yt = await getInnertube();
  const info = await yt.getInfo(videoId);
  const transcriptData = await info.getTranscript();

  const rawSegments =
    (transcriptData?.transcript?.content?.body?.initial_segments as TranscriptSegmentLike[] | undefined) ?? [];

  const segments: TranscriptSegment[] = rawSegments.map((seg) => {
    const startMs = Number(seg.start_ms ?? 0);
    const endMs = Number(seg.end_ms ?? startMs);
    return {
      start: Math.round(startMs) / 1000,
      duration: Math.max(0, Math.round(endMs - startMs) / 1000),
      text: extractSegmentText(seg.snippet),
    };
  });

  const fullText = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();

  return {
    videoId,
    language,
    segments,
    fullText,
  };
}
