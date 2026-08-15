# Context Health Check

Diagnoses "context rot" in AI chat sessions in real time - a live health score, not just a token counter.

## The problem

**Context rot** is the documented phenomenon where an LLM's recall accuracy degrades as a conversation grows, well before it hits the hard token limit. Chroma's 2025 study across 18 frontier models found this degradation is universal - accuracy drops with input length even when the relevant information is still technically "in context." Stanford's "Lost in the Middle" paper showed the same effect concretely: retrieval accuracy falling from roughly 70–75% to 55–60% once a prompt holds around 20 retrieved documents, purely from position and volume, not relevance. Long context windows solve for *fitting* information in; they don't solve for the model still *finding* it once it's buried in there.

Anthropic's own [Claude Cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools) prescribes three mitigations for this: **tool-result clearing**, **compaction**, and **memory**. What it doesn't tell you is *when* to reach for which one - whether the conversation in front of you right now is fine, drifting, or already past the point where the model is quietly guessing. Context Health Check is that missing diagnosis layer: it scores a conversation 0–100, tells you exactly what's driving the score down (bloat, redundant re-pastes, raw window usage), and maps the result directly back to whichever of the three Cookbook primitives actually fixes it.

## See it live

> 📸 **Drop a GIF or screenshot of the side panel open on a real claude.ai conversation here.** Record a short clip of the score updating as you send a message, save it as `docs/sidepanel-demo.gif`, and reference it below:
>
> `![Side panel live on claude.ai](docs/sidepanel-demo.gif)`

Don't want to install anything first? Try the [zero-install web demo](packages/web-demo) - paste a conversation, get a score, nothing leaves your browser.

## Quickstart

### Chrome extension (live side panel)

```bash
git clone https://github.com/<your-username>/context-health-check.git
cd context-health-check
npm install
npm run build -w @context-health/extension
```

Then in Chrome:
1. Go to `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked**, select `packages/extension/dist`.
3. Open a conversation on [claude.ai](https://claude.ai) or [chatgpt.com](https://chatgpt.com) and click the extension icon to open the side panel.

The panel re-scores live as the conversation grows. If it can't detect the page's messages (site layout changed, or you're somewhere it doesn't recognize), it falls back to a paste box automatically instead of showing a blank panel.

### MCP server (self-diagnose a Claude session)

```bash
npm run build -w @context-health/mcp-server
```

Add to your Claude Desktop or Claude Code MCP config:

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

Full details, including the `npx`-ready config for once this is published, are in [`packages/mcp-server/README.md`](packages/mcp-server/README.md).

### Web demo (zero install)

```bash
npm run build -w @context-health/web-demo
open packages/web-demo/dist/index.html
```

One static HTML file, no server, no build step for the person opening it.

## Architecture

Three front doors, one scoring engine - the algorithm exists in exactly one place, and everything else imports it.

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  packages/extension   │   │  packages/mcp-server │   │  packages/web-demo   │
│  Chrome MV3 side panel│   │  local stdio server  │   │  single HTML file     │
│  reads the live DOM   │   │  3 tools for Claude   │   │  paste-box, one-shot │
└──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
           │                          │                          │
           └──────────────┬───────────┴──────────────┬───────────┘
                           │                          │
                           ▼                          ▼
                  ┌──────────────────────────────────────┐
                  │            packages/core              │
                  │  pure TypeScript, zero DOM/network deps│
                  │  token estimation · bloat detection    │
                  │  redundancy detection · scoring         │
                  │  recommendations · ConversationAnalyzer │
                  └──────────────────────────────────────┘
```

- **`packages/core`** parses `{ speaker, text, timestamp? }` turns, estimates tokens, flags bloated and redundant turns, computes a 0–100 score with a risk zone, and generates prioritized recommendations. It never touches a DOM or parses a raw pasted string - every caller normalizes into typed turns first.
- **`packages/extension`** reads the conversation straight off the page via a `MutationObserver` and per-site adapter, re-scoring incrementally as new turns arrive.
- **`packages/mcp-server`** exposes the same engine as three MCP tools so Claude Desktop/Code can score their own session.
- **`packages/web-demo`** is the original single-file HTML prototype, now importing its scoring logic from `core` instead of carrying its own copy.

See [`SHOWCASE.md`](SHOWCASE.md) for the engineering tradeoffs behind these choices, and [`packages/mcp-server/REMOTE.md`](packages/mcp-server/REMOTE.md) for the planned remote/OAuth path.

## Development

```bash
npm install
npm test              # core's Vitest suite
npm run typecheck      # all packages
npm run build          # all packages
```

## License

MIT - see [LICENSE](LICENSE).
