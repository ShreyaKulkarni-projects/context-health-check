import { describe, expect, it } from "vitest";
import { detectBloat } from "../src/bloat.js";
import { buildRecommendations } from "../src/recommendations.js";
import type { RedundantPair } from "../src/types.js";

const noBloat = detectBloat([100, 100, 100]);
const heavyBloat = detectBloat([100, 100, 100, 100, 100, 100, 5000, 5000, 5000]);
const noPairs: RedundantPair[] = [];
const onePair: RedundantPair[] = [{ a: 1, b: 4, similarity: 0.9 }];

describe("buildRecommendations priority ordering", () => {
  it("returns the good-shape fallback when nothing fires", () => {
    const recs = buildRecommendations({
      turnCount: 4,
      peakUsagePct: 10,
      bloat: noBloat,
      redundantPairs: noPairs,
    });
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("good-shape");
  });

  it("fires high-usage when peakUsagePct > 85", () => {
    const recs = buildRecommendations({
      turnCount: 4,
      peakUsagePct: 90,
      bloat: noBloat,
      redundantPairs: noPairs,
    });
    expect(recs[0].id).toBe("high-usage");
  });

  it("does not fire high-usage at exactly 85", () => {
    const recs = buildRecommendations({
      turnCount: 4,
      peakUsagePct: 85,
      bloat: noBloat,
      redundantPairs: noPairs,
    });
    expect(recs.some((r) => r.id === "high-usage")).toBe(false);
  });

  it("fires high-bloat when bloatRatio > 0.35", () => {
    const recs = buildRecommendations({
      turnCount: 9,
      peakUsagePct: 10,
      bloat: heavyBloat,
      redundantPairs: noPairs,
    });
    expect(recs.some((r) => r.id === "high-bloat")).toBe(true);
  });

  it("fires redundant-pastes when there are redundant pairs, naming the turn indices", () => {
    const recs = buildRecommendations({
      turnCount: 6,
      peakUsagePct: 10,
      bloat: noBloat,
      redundantPairs: onePair,
    });
    const rec = recs.find((r) => r.id === "redundant-pastes")!;
    expect(rec).toBeDefined();
    expect(rec.title).toContain("1");
    expect(rec.description).toContain("Turn 2");
    expect(rec.description).toContain("turn 5");
  });

  it("fires consider-compaction when turnCount > 16 and bloat is low", () => {
    const recs = buildRecommendations({
      turnCount: 17,
      peakUsagePct: 10,
      bloat: noBloat,
      redundantPairs: noPairs,
    });
    expect(recs.some((r) => r.id === "consider-compaction")).toBe(true);
  });

  it("does not fire consider-compaction at exactly 16 turns", () => {
    const recs = buildRecommendations({
      turnCount: 16,
      peakUsagePct: 10,
      bloat: noBloat,
      redundantPairs: noPairs,
    });
    expect(recs.some((r) => r.id === "consider-compaction")).toBe(false);
  });

  it("does not fire consider-compaction when bloat is also high (bloat takes priority slot, both can still appear)", () => {
    const recs = buildRecommendations({
      turnCount: 17,
      peakUsagePct: 10,
      bloat: heavyBloat,
      redundantPairs: noPairs,
    });
    // bloatRatio > 0.35 so the turnCount>16 && bloatRatio<=0.35 condition is false
    expect(recs.some((r) => r.id === "consider-compaction")).toBe(false);
    expect(recs.some((r) => r.id === "high-bloat")).toBe(true);
  });

  it("fires all applicable rules simultaneously, in priority order", () => {
    const recs = buildRecommendations({
      turnCount: 20,
      peakUsagePct: 90,
      bloat: heavyBloat,
      redundantPairs: onePair,
    });
    expect(recs.map((r) => r.id)).toEqual(["high-usage", "high-bloat", "redundant-pastes"]);
  });

  it("every recommendation, for every rule, carries non-empty why/how/impact", () => {
    const scenarios = [
      { turnCount: 4, peakUsagePct: 10, bloat: noBloat, redundantPairs: noPairs }, // good-shape
      { turnCount: 4, peakUsagePct: 90, bloat: noBloat, redundantPairs: noPairs }, // high-usage
      { turnCount: 9, peakUsagePct: 10, bloat: heavyBloat, redundantPairs: noPairs }, // high-bloat
      { turnCount: 6, peakUsagePct: 10, bloat: noBloat, redundantPairs: onePair }, // redundant-pastes
      { turnCount: 17, peakUsagePct: 10, bloat: noBloat, redundantPairs: noPairs }, // consider-compaction
    ];
    for (const scenario of scenarios) {
      for (const rec of buildRecommendations(scenario)) {
        expect(rec.why.length).toBeGreaterThan(0);
        expect(Array.isArray(rec.how)).toBe(true);
        expect(rec.how.length).toBeGreaterThan(0);
        for (const step of rec.how) expect(step.length).toBeGreaterThan(0);
        expect(rec.impact.length).toBeGreaterThan(0);
      }
    }
  });

  it("redundant-pastes' why/how reference the specific turn numbers", () => {
    const recs = buildRecommendations({
      turnCount: 6,
      peakUsagePct: 10,
      bloat: noBloat,
      redundantPairs: onePair,
    });
    const rec = recs.find((r) => r.id === "redundant-pastes")!;
    expect(rec.why).toContain("Turn 2");
    expect(rec.why).toContain("turn 5");
    expect(rec.how.some((step) => step.includes("turn 2") && step.includes("turn 5"))).toBe(true);
  });
});
