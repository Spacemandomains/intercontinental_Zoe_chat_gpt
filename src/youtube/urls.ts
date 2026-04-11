/**
 * Canonical URL shaping for YouTube resources. Every tool that surfaces
 * a video or playlist link to the LLM should go through these helpers
 * so the format is consistent and the model never has to assemble URLs
 * from raw IDs itself.
 */

export function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function playlistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}
