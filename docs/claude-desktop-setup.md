# Using the server in Claude Desktop

Claude Desktop discovers MCP servers via the `claude_desktop_config.json` file.

## 1. Build the server

```bash
npm install
npm run build
```

Note the absolute path to `dist/index.js` — Claude Desktop cannot resolve
relative paths.

## 2. Edit `claude_desktop_config.json`

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add a new entry under `mcpServers`:

```json
{
  "mcpServers": {
    "intercontinental-zoe": {
      "command": "node",
      "args": ["/absolute/path/to/intercontinental_Zoe_chat_gpt/dist/index.js"],
      "env": {
        "YOUTUBE_API_KEY": "your-key",
        "RESEND_API_KEY": "your-resend-key",
        "LEAD_EMAIL_TO": "you@example.com",
        "LEAD_EMAIL_FROM": "zoe@yourdomain.com"
      }
    }
  }
}
```

## 3. Restart Claude Desktop

Fully quit and relaunch. The tools should appear in the tool picker and the
`guidance://system` resource should be auto-loaded if you attach the server to
a conversation.

## Multiple servers

Other entries under `mcpServers` are preserved — just add `intercontinental-zoe`
alongside them. Each server is a separate JSON object.

## Troubleshooting

- **Server does not appear.** Check the Claude Desktop logs
  (`~/Library/Logs/Claude/` on macOS). A JSON syntax error in
  `claude_desktop_config.json` silently disables the whole file.
- **Tools appear but calls fail.** Confirm `YOUTUBE_API_KEY` is set in the `env`
  block — Claude Desktop does not inherit your shell environment.
