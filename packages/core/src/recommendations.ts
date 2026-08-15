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
 * if/else chain) - see the acceptance criteria for why ordering matters:
 * downstream consumers (extension panel, MCP tool) render this list top to
 * bottom as "most urgent fix first."
 *
 * Each recommendation carries why (what's causing it, specific to this
 * conversation's numbers), how (ordered, concrete steps), and impact (what
 * changes once you've done it) - not just a title and a one-line summary.
 */
export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const { turnCount, peakUsagePct, bloat, redundantPairs } = input;
  const recs: Recommendation[] = [];

  if (peakUsagePct > 85) {
    const pct = Math.round(peakUsagePct);
    recs.push({
      id: "high-usage",
      icon: "clock",
      colorVar: "var(--status-critical)",
      title: "Start a fresh session and hand off with the memory tool",
      description: `You're at ${pct}% of the context window. Recall accuracy degrades well before the hard limit - write your key findings to memory now and start a new session rather than pushing further into this one.`,
      why: `At ${pct}% of the window, the model has to work harder to recall details from earlier in the conversation. Recall accuracy degrades well before the window is technically full - this isn't a hard cutoff, it's already in progress.`,
      how: [
        "Write a short summary of your key findings, decisions, and anything you need to keep (code, config, exact wording) - don't rely on memory of what was said.",
        "Use the memory tool (or just paste that summary as your first message) to carry it into a new session.",
        "Start a fresh conversation and continue from there instead of pushing further into this one.",
      ],
      impact: "You're back to a clean window with full recall, and the important context survives the reset instead of getting lost in the noise.",
    });
  }

  if (bloat.bloatRatio > 0.35) {
    const count = bloat.bloatCount;
    const pct = Math.round(bloat.bloatRatio * 100);
    recs.push({
      id: "high-bloat",
      icon: "broom",
      colorVar: "var(--series-blue)",
      title: "Turn on tool-result / file-dump clearing",
      description: `${count} oversized turn${count === 1 ? "" : "s"} made up ${pct}% of your total tokens - large pasted files and outputs that could be cleared once they're no longer needed, the way clear_tool_uses works in Claude's context management API.`,
      why: `${count} turn${count === 1 ? "" : "s"} - usually a pasted file, log, or tool output - are eating ${pct}% of your tokens. That content typically stays in context long after you've actually finished needing it.`,
      how: [
        "Identify which turn(s) are flagged as bloat (shown in the KPI above).",
        "Once you're done referencing that pasted content, ask Claude to disregard it, or start a fresh session for the next phase.",
        "If you're building on the API, enable clear_tool_uses so old tool results get cleared automatically instead of manually.",
      ],
      impact: "Those tokens stop counting against your window - more room for actual conversation before you hit rot risk, and the bloat penalty in your score drops to match.",
    });
  }

  if (redundantPairs.length > 0) {
    const pair = redundantPairs[0];
    const simPct = Math.round(pair.similarity * 100);
    recs.push({
      id: "redundant-pastes",
      icon: "loop",
      colorVar: "var(--status-serious)",
      title: `${redundantPairs.length} near-duplicate block${redundantPairs.length === 1 ? "" : "s"} re-pasted into context`,
      description: `Turn ${pair.a + 1} and turn ${pair.b + 1} are ${simPct}% similar - the same content entered context twice. Clearing (or just not re-pasting) would have saved that space outright.`,
      why: `Turn ${pair.a + 1} and turn ${pair.b + 1} are ${simPct}% similar - the same large block of content was pasted in twice, most likely by accident during an edit or a resend.`,
      how: [
        `Check turn ${pair.a + 1} and turn ${pair.b + 1} - confirm they really are duplicates.`,
        "Next time, reference the earlier turn (\"see the file I pasted above\") instead of re-pasting it in full.",
        "If you do need to resend something because it changed, paste only the diff, not the whole block again.",
      ],
      impact: "Removes the duplicate tokens outright - an easy win, since you weren't getting any value from the second copy.",
    });
  }

  if (turnCount > 16 && bloat.bloatRatio <= 0.35) {
    recs.push({
      id: "consider-compaction",
      icon: "note",
      colorVar: "var(--status-good)",
      title: "Consider compaction for this conversation shape",
      description: `Growth here is mostly dialogue and reasoning, not bloat - ${turnCount} turns is enough that a periodic compaction summary (keeping key facts, dropping settled back-and-forth) would keep the working context focused.`,
      why: `${turnCount} turns in, and it's dialogue driving the growth, not bloat - legitimate back-and-forth rather than any single oversized paste. That still fills the window eventually, just more slowly.`,
      how: [
        "Ask Claude to summarize the conversation so far: key decisions made, open questions, and next steps.",
        "Start a new session with that summary as your opening message.",
        "Continue from there instead of re-reading the full history each time.",
      ],
      impact: "The conversation keeps every decision that mattered, in a fraction of the tokens - same continuity, far more headroom before you hit risk again.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "good-shape",
      icon: "check",
      colorVar: "var(--status-good)",
      title: "You're in good shape",
      description: "No major bloat, redundancy, or window-usage risk detected in this transcript. No action needed yet - re-check after a lot more turns.",
      why: "None of the risk conditions above are triggered: window usage, bloat, and redundancy are all within normal range for this conversation's length.",
      how: ["Nothing to do right now.", "Re-check after a lot more turns, or right after pasting something large."],
      impact: "You're already in the state the other recommendations exist to get you back to - no action changes anything yet.",
    });
  }

  return recs;
}
