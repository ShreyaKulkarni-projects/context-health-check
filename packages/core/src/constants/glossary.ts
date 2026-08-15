export interface KpiGlossaryEntry {
  key: "peakUsage" | "bloat" | "redundant" | "turns";
  label: string;
  /** Always-visible one-line description shown under the KPI value. */
  oneLiner: string;
  /** Longer what/why/fix explanation, shown on hover (title attribute) or expansion. */
  detail: string;
}

/**
 * Single source of truth for KPI tile copy, shared by web-demo and the
 * extension side panel so the explanation of what each metric means, why it
 * happens, and how to fix it doesn't drift into two versions.
 */
export const KPI_GLOSSARY: KpiGlossaryEntry[] = [
  {
    key: "peakUsage",
    label: "Peak window used",
    oneLiner: "% of the model's context window used at this conversation's peak",
    detail:
      "What: how full the model's context window is, at its highest point in this conversation. " +
      "Why it happens: every turn - messages, pasted files, tool output - adds tokens, and long conversations or big pastes fill the window over time, which is when recall accuracy starts to degrade. " +
      "Fix: once this crosses ~85%, start a fresh session and hand off your key findings using the memory tool, rather than pushing further into this one. " +
      "After: you're working from a clean window again, with recall back to full strength.",
  },
  {
    key: "bloat",
    label: "Re-fetchable bloat",
    oneLiner: "% of your tokens sitting in a handful of oversized turns",
    detail:
      "What: the share of total tokens concentrated in turns far bigger than the rest of the conversation - usually a pasted file, log, or tool output. " +
      "Why it happens: a big paste goes into the conversation and never gets cleared, even once you're done needing it. " +
      "Fix: turn on tool-result/file-dump clearing - remove that turn's content from context once you've used it (this is what clear_tool_uses does automatically in Claude's context management API). " +
      "After: those tokens stop counting against your window, freeing up room and directly reducing the bloat penalty in the score.",
  },
  {
    key: "redundant",
    label: "Redundant re-pastes",
    oneLiner: "Near-duplicate large blocks pasted into context more than once",
    detail:
      "What: two turns detected as the same, or near-identical, large block of text entered into the conversation twice. " +
      "Why it happens: usually re-pasting a file or output you'd already sent, often by accident during edits. " +
      "Fix: don't re-paste - refer back to the earlier turn instead, or clear it and paste only what changed. " +
      "After: removes the duplicate tokens outright and the redundancy penalty in the score drops to match.",
  },
  {
    key: "turns",
    label: "Turns analyzed",
    oneLiner: "User + assistant turns detected in this conversation",
    detail:
      "What: the total number of back-and-forth turns found in the transcript. " +
      "Why it matters: past 16 turns with bloat still low, growth is coming from dialogue itself, not bloat. " +
      "Fix: consider periodic compaction - summarizing settled back-and-forth into a compact recap - to keep the working context focused without losing decisions already made. " +
      "After: the conversation keeps the same decisions and context, in far fewer tokens.",
  },
];
