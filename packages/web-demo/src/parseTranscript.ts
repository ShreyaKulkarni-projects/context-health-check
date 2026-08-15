import type { ConversationTurn } from "@context-health/core";

/**
 * Regex-based speaker-label parser for the paste-box case. This lives ONLY in
 * web-demo - core never touches a DOM or a raw pasted string with a
 * speaker-label regex; it only ever receives already-normalized
 * ConversationTurn[]. The extension's DOM adapters normalize turns straight
 * from the page, bypassing this parser entirely.
 */
const USER_RE = /^\s*(human|user|you|me|prompt)\s*:\s?/i;
const ASSIST_RE = /^\s*(assistant|claude|chatgpt|gpt|ai|bot|model)\s*:\s?/i;

export interface ParsedTurn extends ConversationTurn {
  /** Display label as it appeared in the transcript, e.g. "Human", "Assistant", "Block 3". */
  label: string;
}

export interface ParseResult {
  turns: ParsedTurn[];
  sawLabels: boolean;
}

function toSpeaker(label: string): ConversationTurn["speaker"] {
  return label === "Assistant" ? "assistant" : "user";
}

export function parseTranscript(raw: string): ParseResult {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const turns: { label: string; text: string }[] = [];
  let current: { label: string; text: string } | null = null;
  let sawLabels = false;

  const pushCurrent = () => {
    if (current && current.text.trim().length > 0) {
      turns.push(current);
    }
  };

  for (const line of lines) {
    const stripped = line.replace(/^\*+/, "").replace(/\*+$/, "");
    if (USER_RE.test(stripped)) {
      pushCurrent();
      sawLabels = true;
      current = { label: "Human", text: stripped.replace(USER_RE, "") };
    } else if (ASSIST_RE.test(stripped)) {
      pushCurrent();
      sawLabels = true;
      current = { label: "Assistant", text: stripped.replace(ASSIST_RE, "") };
    } else {
      if (!current) current = { label: "Unlabeled", text: "" };
      current.text += (current.text ? "\n" : "") + line;
    }
  }
  pushCurrent();

  let finalTurns = turns;
  if (!sawLabels) {
    const blocks = raw.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
    finalTurns = blocks.map((b, idx) => ({ label: `Block ${idx + 1}`, text: b }));
  }

  return {
    turns: finalTurns.map((t) => ({ speaker: toSpeaker(t.label), text: t.text, label: t.label })),
    sawLabels,
  };
}
