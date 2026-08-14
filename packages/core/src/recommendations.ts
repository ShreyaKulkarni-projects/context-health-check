import type { BloatResult } from "./bloat.js";
import type { Recommendation, RedundantPair } from "./types.js";

export interface RecommendationInput {
  turnCount: number;
  peakUsagePct: number;
  bloat: BloatResult;
  redundantPairs: RedundantPair[];
}

/**
 * Priority order, all rules can fire simultaneously (this is a list, not an
 * if/else chain) — see the acceptance criteria for why ordering matters:
 * downstream consumers (extension panel, MCP tool) render this list top to
 * bottom as "most urgent fix first."
 */
export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const { turnCount, peakUsagePct, bloat, redundantPairs } = input;
  const recs: Recommendation[] = [];

  if (peakUsagePct > 85) {
    recs.push({
      id: "high-usage",
      icon: "clock",
      colorVar: "var(--status-critical)",
      title: "Start a fresh session and hand off with the memory tool",
      description: `You're at ${Math.round(peakUsagePct)}% of the context window. Recall accuracy degrades well before the hard limit — write your key findings to memory now and start a new session rather than pushing further into this one.`,
    });
  }

  if (bloat.bloatRatio > 0.35) {
    const count = bloat.bloatCount;
    recs.push({
      id: "high-bloat",
      icon: "broom",
      colorVar: "var(--series-blue)",
      title: "Turn on tool-result / file-dump clearing",
      description: `${count} oversized turn${count === 1 ? "" : "s"} made up ${Math.round(bloat.bloatRatio * 100)}% of your total tokens — large pasted files and outputs that could be cleared once they're no longer needed, the way clear_tool_uses works in Claude's context management API.`,
    });
  }

  if (redundantPairs.length > 0) {
    const pair = redundantPairs[0];
    recs.push({
      id: "redundant-pastes",
      icon: "loop",
      colorVar: "var(--status-serious)",
      title: `${redundantPairs.length} near-duplicate block${redundantPairs.length === 1 ? "" : "s"} re-pasted into context`,
      description: `Turn ${pair.a + 1} and turn ${pair.b + 1} are ${Math.round(pair.similarity * 100)}% similar — the same content entered context twice. Clearing (or just not re-pasting) would have saved that space outright.`,
    });
  }

  if (turnCount > 16 && bloat.bloatRatio <= 0.35) {
    recs.push({
      id: "consider-compaction",
      icon: "note",
      colorVar: "var(--status-good)",
      title: "Consider compaction for this conversation shape",
      description: `Growth here is mostly dialogue and reasoning, not bloat — ${turnCount} turns is enough that a periodic compaction summary (keeping key facts, dropping settled back-and-forth) would keep the working context focused.`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "good-shape",
      icon: "check",
      colorVar: "var(--status-good)",
      title: "You're in good shape",
      description: "No major bloat, redundancy, or window-usage risk detected in this transcript. No action needed yet — re-check after a lot more turns.",
    });
  }

  return recs;
}
