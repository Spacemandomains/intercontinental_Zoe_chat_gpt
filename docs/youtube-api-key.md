# Getting a YouTube Data API v3 key

The MCP server uses YouTube Data API v3 to list videos inside Zoe's per-country
playlists and to fetch video metadata. (Transcripts use `youtubei.js`, which does
not consume quota.)

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/).
2. Top bar → project dropdown → **New Project**. Name it e.g. `intercontinental-zoe`.
3. Select the new project.

## 2. Enable the YouTube Data API v3

1. In the left nav → **APIs & Services → Library**.
2. Search for **YouTube Data API v3**.
3. Click it → **Enable**.

## 3. Create an API key

1. **APIs & Services → Credentials → Create Credentials → API key**.
2. Copy the key.
3. Click the pencil icon on the new key → **API restrictions** → restrict to
   **YouTube Data API v3**. Save.

## 4. Set it locally

```bash
echo 'YOUTUBE_API_KEY=your-key-here' >> .env
```

Or export it in your shell:

```bash
export YOUTUBE_API_KEY=your-key-here
```

## Quota notes

- The default daily quota is 10,000 units.
- `playlistItems.list` costs 1 unit per call.
- `videos.list` costs 1 unit per call (the server batches up to 50 ids per call).
- With 39 playlists of ~50 videos each, a cold catalog build is ~80 units.
- The server caches playlists and video details in-memory with configurable TTLs
  (`CACHE_TTL_PLAYLIST_MS`, `CACHE_TTL_VIDEO_MS`). In production a single cold
  start per day per instance is typical.

## Rotating the key

If the key leaks: delete it under **Credentials** and create a new one. Update the
local `.env` or run `vercel env rm YOUTUBE_API_KEY production && vercel env add YOUTUBE_API_KEY production`
then redeploy with `vercel --prod`.
