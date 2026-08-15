# Contributing

## Setup

```bash
git clone https://github.com/<your-username>/context-health-check.git
cd context-health-check
npm install
```

This is an npm workspaces monorepo - `npm install` at the root links `packages/core` into the other packages as a real dependency, not a copy.

## Project layout

| Package | What it is |
| --- | --- |
| `packages/core` | The scoring engine. Pure TypeScript, zero DOM/network dependencies. **Any change to the algorithm belongs here, and only here** - the other three packages must never carry their own copy of scoring logic. |
| `packages/extension` | Chrome MV3 side panel. |
| `packages/mcp-server` | Local stdio MCP server. |
| `packages/web-demo` | Single-file HTML demo. |

## Common tasks

```bash
npm test                                    # core's Vitest suite
npm run typecheck                            # all packages
npm run build                                # all packages

npm run test:watch -w @context-health/core   # core, watch mode
npm run dev -w @context-health/extension     # extension, Vite dev server (HMR)
npm run dev -w @context-health/mcp-server    # mcp-server, watch mode
```

## Before opening a PR

- If you touched `packages/core`: add or update tests. `npm test` covers token estimation, bloat detection, redundancy true/false positives, score/grade boundaries, and recommendation ordering - a change that doesn't move any of those numbers usually means the test is missing, not that nothing changed.
- If you touched visual output shared across packages (colors, meter/KPI/chart styling): change it in `packages/core/src/constants/theme.css` (and `theme.ts` if it's a raw hex value used outside CSS), not in an individual package. `web-demo` and `extension` both import from there specifically so there's one palette, not three.
- Run `npm run typecheck` and `npm run build` before pushing - a package that fails to build silently breaks whichever front door imports it.
- Commit in reviewable chunks scoped to one package or concern at a time, the way the existing history does - not one giant diff across all four packages.

## Reporting a bug in the adapters

`packages/extension/src/adapters/{claude,chatgpt}.ts` read the live DOM of two React SPAs that don't publish a stable markup contract - they will drift over time. If detection breaks:

1. Confirm the panel actually fell back to the paste box (it should - that's the intended degradation, not a crash).
2. Open a DevTools console on the affected page and inspect the current markup around a message turn.
3. Open an issue with what changed, or a PR updating the adapter's primary selector - keep the structural-heuristic fallback in place either way.
