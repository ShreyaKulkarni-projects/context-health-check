# @context-health/mcp-server

A local, stdio-transport [MCP](https://modelcontextprotocol.io) server that exposes the Context Health Check scoring engine as tools - so Claude Desktop or Claude Code can self-diagnose a session's own context rot.

Backed entirely by [`@context-health/core`](../core); no network calls, no hosting, runs on your machine.

## Tools

| Tool | Returns |
| --- | --- |
| `analyze_conversation` | Full diagnosis: score, grade, risk zone, KPIs, and recommendations |
| `get_context_health_score` | Just `{ score, grade }`, for a quick check |
| `get_recommendations` | Just the actionable fix list |

All three take the same input:

```json
{
  "turns": [
    { "speaker": "user", "text": "..." },
    { "speaker": "assistant", "text": "..." }
  ],
  "contextWindow": 200000
}
```

`contextWindow` is optional (defaults to 200,000 - Claude's standard window).

## Setup

### 1. Build

From the repo root:

```bash
npm install
npm run build -w @context-health/mcp-server
```

This produces `dist/index.js` with a `#!/usr/bin/env node` shebang, runnable directly or via `npx` once published.

### 2. Add to Claude Desktop or Claude Code

Add this to your MCP config (Claude Desktop: `claude_desktop_config.json`; Claude Code: your project or global MCP settings):

```json
{
  "mcpServers": {
    "context-health": {
      "command": "node",
      "args": ["/absolute/path/to/context-health-check/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Once published to npm, the same entry works via:

```json
{
  "mcpServers": {
    "context-health": {
      "command": "npx",
      "args": ["-y", "context-health-mcp"]
    }
  }
}
```

### 3. Verify with the MCP Inspector

```bash
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list
```

Or launch the interactive inspector UI (no `--cli`) to call tools by hand.

## Remote/OAuth (v2)

This is a **local, stdio-only** server in v1 - no hosting, no auth, works the moment you add it to your config. See [REMOTE.md](./REMOTE.md) for the documented plan to add a remote, OAuth-authenticated transport for a future Connectors Directory submission.
