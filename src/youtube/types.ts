export interface VideoSnippet {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  channelTitle: string;
  thumbnailUrl: string;
  position?: number;
}

export interface VideoDetails extends VideoSnippet {
  durationSeconds: number;
  durationIso: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
}

export interface CatalogVideo extends VideoDetails {
  sourceDestinationIds: string[];
  sourcePlaylistIds: string[];
}

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface VideoTranscript {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
}

export interface PlaylistInfo {
  playlistId: string;
  title: string;
  description: string;
  channelTitle: string;
  itemCount: number;
}
