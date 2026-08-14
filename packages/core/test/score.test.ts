import { describe, expect, it } from "vitest";
import { clamp, computeScore, riskZoneFor } from "../src/score.js";

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });
  it("clamps above max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });
  it("passes through values in range", () => {
    expect(clamp(42, 0, 100)).toBe(42);
  });
});

describe("riskZoneFor", () => {
  it("< 50% is good", () => {
    expect(riskZoneFor(0).key).toBe("good");
    expect(riskZoneFor(49.9).key).toBe("good");
  });
  it("50-75% is warning", () => {
    expect(riskZoneFor(50).key).toBe("warning");
    expect(riskZoneFor(74.9).key).toBe("warning");
  });
  it("75-90% is serious", () => {
    expect(riskZoneFor(75).key).toBe("serious");
    expect(riskZoneFor(89.9).key).toBe("serious");
  });
  it(">= 90% is critical", () => {
    expect(riskZoneFor(90).key).toBe("critical");
    expect(riskZoneFor(150).key).toBe("critical");
  });
});

describe("computeScore boundaries", () => {
  it("perfect conditions (0% usage, 0 bloat, 0 redundancy) scores 100 and Healthy", () => {
    const result = computeScore(0, 0, 0);
    expect(result.score).toBe(100);
    expect(result.grade.key).toBe("good");
    expect(result.grade.label).toBe("Healthy");
  });

  it("worst-case usage/bloat/redundancy hits the penalty ceiling (40+30+24=94, score=6)", () => {
    const result = computeScore(500, 1, 100);
    expect(result.usagePenalty).toBe(40);
    expect(result.bloatPenalty).toBe(30);
    expect(result.redundancyPenalty).toBe(24);
    expect(result.score).toBe(6);
    expect(result.grade.key).toBe("critical");
    expect(result.grade.label).toBe("Critical");
  });

  it("score clamps at 0 when raw goes negative (bounded separately from the 94-point penalty ceiling)", () => {
    // clamp(100 - usagePenalty - bloatPenalty - redundancyPenalty, 0, 100) — verify the
    // clamp itself, independent of computeScore's real penalty ceiling.
    expect(clamp(100 - 94, 0, 100)).toBe(6);
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("usage penalty is capped at 40 (peakUsagePct >= 100)", () => {
    const result = computeScore(100, 0, 0);
    expect(result.usagePenalty).toBe(40);
    expect(result.score).toBe(60);
  });

  it("usage penalty is 0 at or below 50% usage", () => {
    expect(computeScore(50, 0, 0).usagePenalty).toBe(0);
    expect(computeScore(20, 0, 0).usagePenalty).toBe(0);
  });

  it("bloat penalty is capped at 30 (bloatRatio = 1)", () => {
    const result = computeScore(0, 1, 0);
    expect(result.bloatPenalty).toBe(30);
  });

  it("redundancy penalty is capped at 24 regardless of pair count", () => {
    expect(computeScore(0, 0, 3).redundancyPenalty).toBe(24);
    expect(computeScore(0, 0, 100).redundancyPenalty).toBe(24);
  });

  it("grade boundary: 85 -> Healthy, 84 -> Keep an eye on it", () => {
    // usagePenalty = clamp(pct-50,0,50)*0.8. Choose pct so usagePenalty=15 -> score=85.
    // 15 = (pct-50)*0.8 -> pct-50=18.75 -> pct=68.75
    expect(computeScore(68.75, 0, 0).score).toBe(85);
    expect(computeScore(68.75, 0, 0).grade.label).toBe("Healthy");
    // one point worse: pct=70 -> usagePenalty=16 -> score=84
    expect(computeScore(70, 0, 0).score).toBe(84);
    expect(computeScore(70, 0, 0).grade.label).toBe("Keep an eye on it");
  });

  it("grade boundary: 65 -> Keep an eye on it, 64 -> At risk", () => {
    // usagePenalty=35 -> pct-50=43.75 -> pct=93.75
    expect(computeScore(93.75, 0, 0).score).toBe(65);
    expect(computeScore(93.75, 0, 0).grade.label).toBe("Keep an eye on it");
    // usagePenalty=36 -> pct=95
    expect(computeScore(95, 0, 0).score).toBe(64);
    expect(computeScore(95, 0, 0).grade.label).toBe("At risk");
  });

  it("grade boundary: 40 -> At risk, 39 -> Critical", () => {
    // usagePenalty=40 (max, pct>=100), remaining penalty from bloat to hit exactly 60 total penalty
    // score=40 -> total penalty=60 -> usagePenalty=40 (pct=100) + bloatPenalty=20 (bloatRatio=0.6667)
    const atRisk = computeScore(100, 20 / 30, 0);
    expect(atRisk.score).toBe(40);
    expect(atRisk.grade.label).toBe("At risk");
    const critical = computeScore(100, 21 / 30, 0);
    expect(critical.score).toBe(39);
    expect(critical.grade.label).toBe("Critical");
  });
});
