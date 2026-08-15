import { describe, expect, it } from "vitest";
import { detectRedundancy, jaccard, shingles } from "../src/redundancy.js";
import { CharHeuristicEstimator } from "../src/tokenizers/charHeuristic.js";

const estimator = new CharHeuristicEstimator();

// >300 tokens at ~4 chars/token means >1200 chars - big enough to clear the
// redundancy candidate-size floor.
const bigBlock = (seed: string) => (seed + " ").repeat(120);

describe("shingles / jaccard", () => {
  it("identical text has similarity 1", () => {
    const text = bigBlock("hello world");
    expect(jaccard(shingles(text), shingles(text))).toBeCloseTo(1, 5);
  });

  it("completely disjoint text has similarity 0", () => {
    const a = shingles("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const b = shingles("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz");
    expect(jaccard(a, b)).toBe(0);
  });

  it("empty sets have similarity 0", () => {
    expect(jaccard(new Set(), new Set(["x"]))).toBe(0);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("is case-insensitive and whitespace-collapsing", () => {
    const a = shingles("Hello   World, this is a TEST of the shingle function.");
    const b = shingles("hello world, this is a test of the shingle function.");
    expect(jaccard(a, b)).toBeCloseTo(1, 5);
  });
});

describe("detectRedundancy", () => {
  it("flags a deliberately duplicated large block as redundant", () => {
    const original = bigBlock("The onboarding doc explains setup steps in detail. ");
    const texts = [
      "short intro turn",
      original,
      "a different short reply",
      original, // re-pasted verbatim
    ];
    const tokenCounts = texts.map((t) => estimator.estimate(t));
    const pairs = detectRedundancy(texts, tokenCounts);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs.some((p) => p.a === 1 && p.b === 3)).toBe(true);
    expect(pairs.find((p) => p.a === 1 && p.b === 3)!.similarity).toBeGreaterThan(0.45);
  });

  it("does not false-positive on deliberately distinct large blocks", () => {
    const blockA = bigBlock("Release process: tag main, run CI, deploy to staging first.");
    const blockB = bigBlock("API reference: GET /v1/users returns a paginated list of results.");
    const texts = ["intro", blockA, "middle turn", blockB];
    const tokenCounts = texts.map((t) => estimator.estimate(t));
    const pairs = detectRedundancy(texts, tokenCounts);
    expect(pairs).toEqual([]);
  });

  it("ignores turns under the 300-token candidate floor even if identical", () => {
    const shortDupe = "same short text repeated";
    const texts = [shortDupe, shortDupe];
    const tokenCounts = texts.map((t) => estimator.estimate(t));
    expect(tokenCounts[0]).toBeLessThanOrEqual(300);
    const pairs = detectRedundancy(texts, tokenCounts);
    expect(pairs).toEqual([]);
  });

  it("returns no pairs for a single turn", () => {
    const texts = [bigBlock("solo turn")];
    const tokenCounts = texts.map((t) => estimator.estimate(t));
    expect(detectRedundancy(texts, tokenCounts)).toEqual([]);
  });
});
