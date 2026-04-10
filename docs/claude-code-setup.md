# Using the server in Claude Code

Claude Code supports MCP servers both over stdio (local) and over HTTP (remote).

## Local (stdio)

1. Build the server:
   ```bash
   npm install && npm run build
   ```
2. Register it with Claude Code:
   ```bash
   claude mcp add intercontinental-zoe \
     --env YOUTUBE_API_KEY=your-key \
     --env RESEND_API_KEY=your-resend-key \
     --env LEAD_EMAIL_TO=you@example.com \
     --env LEAD_EMAIL_FROM=zoe@yourdomain.com \
     -- node /absolute/path/to/intercontinental_Zoe_chat_gpt/dist/index.js
   ```
3. Restart Claude Code. You should see all 11 tools under the server name when
   you type `/mcp` or invoke a tool.

## Remote (HTTP + Bearer auth)

Assuming the server is deployed to Fly.io (see root `README.md`):

```bash
claude mcp add intercontinental-zoe \
  --transport http https://<app>.fly.dev/mcp \
  --header "Authorization: Bearer <your HTTP_AUTH_TOKEN>"
```

## Verifying

Try one of the canonical prompts:

- "Where in Southeast Asia has Zoe been?"
- "What's included in a travel consultation?"
- "I'm planning a trip to Colombia. Where do I start?"
- "What rentals are available in the Philippines?"
- "How much are the destination guides?"
- "How can I support Zoe's travels?"

Every response should be grounded in the canonical data. If the model invents a
destination or service, check that `guidance://system` is being loaded (Claude
Code reads MCP resources by default — look for a `guidance` entry in the server
details pane).

## Troubleshooting

- **No videos returned.** Confirm `data/destinations.json` has real YouTube playlist
  IDs (not the `REPLACE_WITH_*` placeholders) and that `YOUTUBE_API_KEY` is valid.
- **`start_lead` fails.** Make sure `RESEND_API_KEY`, `LEAD_EMAIL_TO`, and
  `LEAD_EMAIL_FROM` are all set and the from-address is verified in Resend.
- **Hallucinated destinations.** Re-read `data/guidance.md` and confirm the tool
  descriptions haven't been edited to weaken the "do not invent" language.
