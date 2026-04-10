# Using the server with ChatGPT

ChatGPT supports the server two different ways:

1. **MCP connector** (ChatGPT Pro / Team / Enterprise): points at the Streamable
   HTTP endpoint `/mcp`.
2. **Custom GPT Action** (any paid tier): imports the auto-generated OpenAPI
   document from `/openapi.json` and calls REST endpoints under `/actions/:tool`.

Both reuse the **same** handlers; the REST mirror just wraps the validated tool
handlers in a thin Express adapter.

## Prerequisites

1. Deploy the HTTP server to Vercel. The repo ships with a
   `vercel.json` + `api/[...path].ts` serverless function — no Dockerfile, no
   long-running process:
   ```bash
   npm install -g vercel
   vercel link
   vercel env add YOUTUBE_API_KEY       # YouTube Data API v3 key
   vercel env add HTTP_AUTH_TOKEN       # long random token (Bearer auth)
   vercel env add RESEND_API_KEY        # optional: enables start_lead emails
   vercel env add LEAD_EMAIL_TO         # optional: lead delivery address
   vercel env add LEAD_EMAIL_FROM       # optional: verified Resend sender
   vercel --prod
   ```
   > Use the **Pro** tier if possible — the Hobby tier's 10s function timeout
   > can clip the first YouTube-tool call on a cold container while it hydrates
   > 25 playlists in parallel. Canonical-data tools work fine on Hobby.
2. Verify it's alive:
   ```bash
   curl https://<project>.vercel.app/healthz
   curl https://<project>.vercel.app/openapi.json | head
   ```

## Option A — MCP connector (Pro / Team / Enterprise)

1. In ChatGPT: **Settings → Connectors → Add connector → MCP**.
2. **Server URL:** `https://<project>.vercel.app/mcp`
3. **Auth:** Bearer token, value = the `HTTP_AUTH_TOKEN` you set on Vercel.
4. Save, then enable the connector in a new chat.
5. Ask "Where in Southeast Asia has Zoe been?" — ChatGPT should call
   `list_destinations` and ground the answer in canonical data.

## Option B — Custom GPT Action (any paid tier)

1. In ChatGPT: **Explore GPTs → Create → Configure → Actions → Create new action**.
2. **Import from URL:** paste `https://<project>.vercel.app/openapi.json`.
   ChatGPT will populate the operations (one per tool).
3. **Authentication → API Key → Custom → Header name `Authorization`, value
   `Bearer <your HTTP_AUTH_TOKEN>`**. Save.
4. In the GPT's **Instructions**, paste the contents of `data/guidance.md` so
   the GPT is aware of the grounding rules up front. (Custom GPTs cannot read
   MCP resources automatically — the system prompt is the substitute.)
5. Optional but recommended: in the **Knowledge / Conversation starters** fields,
   add the six canonical prompts listed in the root README. They make the sales
   funnel obvious to first-time visitors.

## Which should I use?

| | MCP connector | Custom GPT Action |
|---|---|---|
| Availability | ChatGPT Pro / Team / Enterprise | Any paid ChatGPT tier |
| Tool protocol | Native MCP (Streamable HTTP) | OpenAPI 3.1 over REST |
| Auto-loads `guidance://system` | ✅ | ❌ (paste into GPT instructions) |
| One-off tool calls | ✅ | ✅ |
| Discoverability in the store | ❌ | ✅ (publishable) |

Both talk to the same server and produce identical responses.

## Anti-hallucination reminder

If you notice the model inventing PayPal links, destinations, or prices:

1. Check that `data/guidance.md` is pasted into the Custom GPT instructions (or
   that the MCP client is auto-loading `guidance://system`).
2. Confirm your `data/*.json` files have the real URLs and prices.
3. Review the tool descriptions in `src/tools/*.ts` — each one ends with
   "Return only values from the canonical data — do not invent…". That language
   matters.
