#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyze, DEFAULT_CONTEXT_WINDOW } from "@context-health/core";

const turnSchema = z.object({
  speaker: z.enum(["user", "assistant"]),
  text: z.string(),
  timestamp: z.number().optional(),
});

const inputShape = {
  turns: z.array(turnSchema).describe("Ordered conversation turns to analyze."),
  contextWindow: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(`Context window size in tokens. Defaults to ${DEFAULT_CONTEXT_WINDOW} (Claude's 200K window).`),
};

const server = new McpServer({
  name: "context-health-mcp",
  version: "0.1.0",
});

server.tool(
  "analyze_conversation",
  "Full context-rot diagnosis for a conversation: 0-100 health score, grade, risk zone, KPIs (peak window usage, bloat ratio, redundant re-pastes), and prioritized recommendations.",
  inputShape,
  async ({ turns, contextWindow }) => {
    const result = analyze(turns, { contextWindow });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_context_health_score",
  "Quick check: just the 0-100 context health score and grade label for a conversation.",
  inputShape,
  async ({ turns, contextWindow }) => {
    const result = analyze(turns, { contextWindow });
    const summary = { score: result.score.score, grade: result.score.grade.label };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool(
  "get_recommendations",
  "Just the actionable fix list for a conversation: which context-management primitive (clearing, compaction, or memory hand-off) to reach for and why.",
  inputShape,
  async ({ turns, contextWindow }) => {
    const result = analyze(turns, { contextWindow });
    return { content: [{ type: "text", text: JSON.stringify(result.recommendations, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("context-health-mcp fatal error:", err);
  process.exit(1);
});
