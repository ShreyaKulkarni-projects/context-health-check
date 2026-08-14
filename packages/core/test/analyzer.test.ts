import { describe, expect, it } from "vitest";
import { analyze, ConversationAnalyzer } from "../src/analyzer.js";
import type { ConversationTurn } from "../src/types.js";

const bigBlock = (seed: string) => (seed + " ").repeat(120);

function demoTurns(): ConversationTurn[] {
  return [
    { speaker: "user", text: "Hey, can you help me clean up this doc?" },
    { speaker: "assistant", text: "Sure, paste it over." },
    { speaker: "user", text: bigBlock("onboarding.md step 1 step 2 step 3") },
    { speaker: "assistant", text: "A few things stand out, want me to rewrite it?" },
    { speaker: "user", text: bigBlock("onboarding.md step 1 step 2 step 3") }, // re-paste
  ];
}

describe("analyze (one-shot)", () => {
  it("produces a full AnalysisResult with turns, score, and recommendations", () => {
    const result = analyze(demoTurns(), { contextWindow: 200_000 });
    expect(result.turns).toHaveLength(5);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.score.score).toBeGreaterThanOrEqual(0);
    expect(result.score.score).toBeLessThanOrEqual(100);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("detects the deliberately re-pasted block as a redundant pair", () => {
    const result = analyze(demoTurns(), { contextWindow: 200_000 });
    expect(result.redundantPairs.some((p) => p.a === 2 && p.b === 4)).toBe(true);
  });

  it("returns an empty-but-valid result for zero turns", () => {
    const result = analyze([], { contextWindow: 200_000 });
    expect(result.turns).toEqual([]);
    expect(result.totalTokens).toBe(0);
    expect(result.score.score).toBe(100);
    expect(result.recommendations[0].id).toBe("good-shape");
  });
});

describe("ConversationAnalyzer (incremental)", () => {
  it("addTurn matches the one-shot analyze() result after the same turns", () => {
    const turns = demoTurns();
    const oneShot = analyze(turns, { contextWindow: 200_000 });

    const analyzer = new ConversationAnalyzer({ contextWindow: 200_000 });
    let last;
    for (const turn of turns) {
      last = analyzer.addTurn(turn);
    }

    expect(last!.totalTokens).toBe(oneShot.totalTokens);
    expect(last!.score.score).toBe(oneShot.score.score);
    expect(last!.redundantPairs).toEqual(oneShot.redundantPairs);
    expect(last!.recommendations.map((r) => r.id)).toEqual(oneShot.recommendations.map((r) => r.id));
  });

  it("returns a fresh, correct result after each incremental addTurn call", () => {
    const analyzer = new ConversationAnalyzer({ contextWindow: 200_000 });
    const r1 = analyzer.addTurn({ speaker: "user", text: "short first turn" });
    expect(r1.turns).toHaveLength(1);
    expect(r1.totalTokens).toBe(r1.turns[0].tokens);

    const r2 = analyzer.addTurn({ speaker: "assistant", text: "short second turn" });
    expect(r2.turns).toHaveLength(2);
    expect(r2.totalTokens).toBe(r1.totalTokens + r2.turns[1].tokens);
  });

  it("reset() clears all state", () => {
    const analyzer = new ConversationAnalyzer({ contextWindow: 200_000 });
    analyzer.addTurn({ speaker: "user", text: "hello" });
    analyzer.reset();
    const result = analyzer.getResult();
    expect(result.turns).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });
});
