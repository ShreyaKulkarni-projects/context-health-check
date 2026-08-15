# Remote/OAuth plan (v2, not yet built)

v1 ships local-only over stdio: zero hosting, works the instant a user points Claude Desktop/Code at the built binary. That's the right default for a portfolio-stage tool - no infrastructure to run or pay for, no auth flow to debug.

A remote version becomes worth building if this ever needs to be:
- Usable from Claude.ai's Connectors Directory (which requires a hosted, authenticated remote server - stdio-local tools can't be listed there), or
- Shared across a team without every member running/building it locally.

This document is the plan for that, written now so the path is deliberate rather than an afterthought, but **not implemented in v1**.

## What changes

### 1. Transport: stdio → Streamable HTTP

The MCP SDK supports a Streamable HTTP transport alongside stdio. The tool implementations (`analyze_conversation`, `get_context_health_score`, `get_recommendations`) don't change at all - they're already pure functions over `@context-health/core`. Only `src/index.ts`'s transport wiring changes: swap `StdioServerTransport` for an HTTP server (e.g. Express or the SDK's built-in HTTP transport helper) that exposes the MCP endpoint over `POST /mcp` (or similar), handling the session lifecycle Streamable HTTP expects (initialize → message exchange → optional SSE stream for server-initiated messages).

### 2. Auth: OAuth 2.1

The Connectors Directory requires OAuth 2.1 for remote MCP servers. That means standing up:
- An authorization server (or delegating to an existing one - e.g. if this ever needs per-user identity, Auth0/Clerk/a custom minimal OAuth provider) issuing access tokens scoped to this MCP server.
- A `/.well-known/oauth-authorization-server` (or `oauth-protected-resource`) metadata endpoint per the MCP spec's discovery requirements, so clients (Claude.ai, other MCP clients) can find the auth flow without manual configuration.
- Token validation middleware in front of the MCP endpoint - reject unauthenticated requests, attach the validated identity to the request context.

Given this tool's actual data flow (conversation turns passed in per-request, nothing persisted server-side), auth here is about *rate-limiting and identifying callers*, not protecting stored user data - there isn't any. That keeps the auth surface smaller than a typical OAuth resource server: no user database, no per-user data at rest, just "is this a legitimate, rate-limited caller."

### 3. Hosting

Needs a small always-on Node process (this is a stateless request/response service - no persistent connections beyond an active MCP session's SSE stream). Candidates, roughly in order of setup cost:
- **Fly.io / Railway / Render** - simplest path for a single small Node service, minimal ops.
- **Cloudflare Workers** (via the MCP SDK's Workers-compatible transport, if/when stable) - would remove hosting cost entirely for the request/response tool calls, though the SSE-based server-push side of Streamable HTTP needs Workers' Durable Objects or similar for session state.

Either way: no database needed (nothing is persisted between calls), so hosting stays close to "deploy a stateless container" rather than "run a service with a data layer."

### 4. Connectors Directory submission checklist (once the above exists)

- [ ] Streamable HTTP transport live at a stable public URL
- [ ] OAuth 2.1 flow implemented and passing the MCP spec's authorization requirements
- [ ] `/.well-known` discovery metadata in place
- [ ] Tool descriptions/schemas reviewed for clarity from a stranger's perspective (Connectors Directory reviewers see these without any of this repo's context)
- [ ] Privacy stance restated for the hosted context: unlike the extension (which never leaves the browser) and stdio v1 (which never leaves the user's machine), a remote server *does* receive conversation text over the network to score it - that tradeoff needs to be stated plainly, not glossed over, since it's a real change from v1's story
- [ ] Rate limiting / abuse handling on the public endpoint
- [ ] Submission per Anthropic's Connectors Directory review process
