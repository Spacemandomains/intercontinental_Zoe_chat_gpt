# Intercontinental Zoe — MCP Travel + Sales Funnel Server

An MCP (Model Context Protocol) server for travel YouTuber **Intercontinental Zoe**.
It exposes:

- Zoe's **per-country YouTube playlists** as a single searchable catalog (metadata,
  details, transcripts, keyword search).
- A **grounded knowledge base** for all destinations she has visited and every service
  she offers — zero hallucination; every value comes from canonical JSON in `data/`.
- A **natural sales funnel** toward travel consultations (PayPal + Crisp live chat),
  destination guides (Shopify), Zoe Location rentals (Airbnb + other rental sites),
  merchandise, and contributions.

Works with **Claude Code, Claude Desktop, ChatGPT (MCP connector)**, and any
MCP-capable LLM client. The same server also exposes a REST mirror + OpenAPI 3.1
spec so it can be imported as a **ChatGPT Custom GPT Action**.

## Architecture at a glance

```
LLM client ─┬─► stdio MCP ──► McpServer ──► registerTool() ──► handler
            │                        │                └──► ctx.handlers (Map)
            └─► HTTP /mcp ───────────┘                          ▲
                                                                │
            ChatGPT Custom GPT Action ──► POST /actions/:tool ──┘
                                          GET  /openapi.json

canonical JSON  ─► loader (zod) ─► CanonicalData ─► ToolContext
per-country YT ─► catalog builder ─► unified Catalog ─► ToolContext
```

- **One server, two transports.** `MCP_TRANSPORT=stdio` (default) or `http`.
- **One set of handlers.** Every tool registers itself both with the MCP server and
  into `ctx.handlers`. The REST `/actions/:toolName` mirror reuses the exact same
  validated handler — no JSON-RPC re-dispatch.
- **One canonical data set.** Loaded once per container, validated with zod,
  reloaded on `SIGHUP` (long-running deploys) so Zoe can edit `data/*.json`
  without a restart.
- **One unified YouTube catalog.** Every destination's `playlistId` is fetched
  in parallel and merged; each video is tagged with the destinations it belongs
  to. Built **lazily** on serverless (Vercel) so cold starts aren't blocked on
  YouTube — hydration triggers on the first video-tool call, and subsequent
  warm invocations reuse the cached catalog.

## Tools (11)

### YouTube
- `list_videos` — paged list across the unified catalog, optionally scoped to one destination.
- `get_video_details` — full metadata + parsed chapters + destinations.
- `get_video_transcript` — timestamped segments + full text (cached).
- `search_videos` — keyword search across the unified catalog.

### Knowledge base
- `list_destinations` — filter by region, country, or continent.
- `get_destination_overview` — bundled: summary + videos + guide + rentals + recommended services + tips.

### Sales funnel
- `list_services` — all services with exact price + duration.
- `get_service_details` — full details, PayPal link, Crisp chat link, next-step CTA.
- `list_products` — guides / rentals / merchandise, filterable by destination.
- `list_support_options` — donations, Patreon, merch, affiliates.
- `start_lead` — captures visitor info + sends email via Resend, returns PayPal + Crisp links.

Every tool response ends in a structured `nextSteps[]` array the LLM uses to keep
the conversation moving forward.

## Anti-hallucination strategy

1. Canonical JSON in `data/` is the only source of truth.
2. Every tool description explicitly forbids invention.
3. An MCP resource `guidance://system` (contents of `data/guidance.md`) spells out
   the ground rules so clients that support resources can auto-load them.
4. Unknown inputs return a documented `notFound` response with CTAs (consultation
   booking, general lead capture).
5. Prices are exact decimals — never ranges, never approximations.

## Quick start

```bash
npm install
cp .env.example .env   # fill in YOUTUBE_API_KEY and (optional) Resend vars
npm run build
npm start              # stdio transport — for Claude Desktop / Claude Code
# or
npm run start:http     # HTTP transport — for ChatGPT MCP connector / Custom GPT
```

### Required environment

| Var | Required? | Purpose |
|---|---|---|
| `YOUTUBE_API_KEY` | yes | YouTube Data API v3 key (see `docs/youtube-api-key.md`) |
| `RESEND_API_KEY` | for leads | Email delivery for `start_lead` |
| `LEAD_EMAIL_TO` | for leads | Where Zoe receives lead emails |
| `LEAD_EMAIL_FROM` | for leads | Verified Resend sender address |
| `MCP_TRANSPORT` | no | `stdio` (default) or `http` |
| `PORT` | no | HTTP port (default `3000`) |
| `HTTP_AUTH_TOKEN` | no | If set, `/mcp` and `/actions/*` require `Authorization: Bearer <token>` |
| `DATA_DIR` | no | Path to canonical data dir (default `./data`) |
| `DEFAULT_TRANSCRIPT_LANG` | no | Default caption language (default `en`) |

## Canonical data

```
data/
├── destinations.json   # each has playlistId + refs to products + tips
├── regions.json        # region → [countries]
├── services.json       # price, PayPal link, Crisp link per service
├── products.json       # guides, rentals, merch (Shopify / Airbnb / ...)
├── support.json        # donation / Patreon / merch options
└── guidance.md         # exposed as guidance://system MCP resource
```

See `docs/data-authoring.md` for the editing workflow and SIGHUP hot reload.

## Client setup

- Claude Code: `docs/claude-code-setup.md`
- Claude Desktop: `docs/claude-desktop-setup.md`
- ChatGPT (MCP connector + Custom GPT Actions): `docs/chatgpt-setup.md`
- YouTube API key: `docs/youtube-api-key.md`

## Deployment (Vercel)

The server ships with a single Vercel serverless function at `api/[...path].ts`
and a `vercel.json` that rewrites `/mcp`, `/actions/:tool`, `/openapi.json`, and
`/healthz` onto it. No Dockerfile, no long-running process, no Fly.io.

```bash
npm install -g vercel
vercel link                          # link this repo to a Vercel project
vercel env add YOUTUBE_API_KEY       # paste your YouTube Data API v3 key
vercel env add HTTP_AUTH_TOKEN       # long random token used as Bearer auth
vercel env add RESEND_API_KEY        # optional: enables start_lead emails
vercel env add LEAD_EMAIL_TO         # optional: where Zoe receives leads
vercel env add LEAD_EMAIL_FROM       # optional: verified Resend sender
vercel --prod                        # deploy to production
```

After deploy the server is reachable at:

- `https://<project>.vercel.app/mcp` — MCP Streamable HTTP
- `https://<project>.vercel.app/actions/<tool>` — REST mirror (Bearer-auth)
- `https://<project>.vercel.app/openapi.json` — OpenAPI 3.1 for Custom GPT import
- `https://<project>.vercel.app/healthz` — health probe

### Cold-start behavior

The function uses **lazy catalog hydration**: cold starts only load the canonical
JSON (fast), and YouTube playlists are fetched in parallel on the first call to
a video-related tool (`list_videos`, `search_videos`, `get_video_details`,
`get_video_transcript`, `get_destination_overview`). Tools that only read
canonical data (`list_services`, `get_service_details`, `list_products`,
`list_support_options`, `list_destinations`, `start_lead`) respond in tens of
milliseconds even on a cold container.

> **Hobby tier caveat:** the first YouTube-tool call on a cold container may
> exceed the 10s Hobby timeout while hydrating 25 playlists. Use the Pro tier
> (`maxDuration: 60`) for production deployments.

## License

MIT — see `LICENSE`.
