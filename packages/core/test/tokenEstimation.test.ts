import { describe, expect, it } from "vitest";
import { CharHeuristicEstimator } from "../src/tokenizers/charHeuristic.js";
import { GptTokenizerEstimator } from "../src/tokenizers/gptTokenizer.js";

describe("CharHeuristicEstimator", () => {
  const estimator = new CharHeuristicEstimator();

  it("estimates ~4 characters per token", () => {
    expect(estimator.estimate("a".repeat(400))).toBe(100);
  });

  it("rounds up for partial tokens", () => {
    expect(estimator.estimate("abc")).toBe(1);
    expect(estimator.estimate("abcde")).toBe(2);
  });

  it("returns at least 1 token for non-empty text", () => {
    expect(estimator.estimate("x")).toBe(1);
  });

  it("scales linearly with length", () => {
    expect(estimator.estimate("a".repeat(4000))).toBe(1000);
  });
});

describe("GptTokenizerEstimator", () => {
  it("returns a positive integer token count for known text", () => {
    const estimator = new GptTokenizerEstimator("o200k_base");
    const count = estimator.estimate("The quick brown fox jumps over the lazy dog.");
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  it("cl100k_base and o200k_base both tokenize non-trivially", () => {
    const text = "context engineering, tool-result clearing, compaction, and memory";
    const cl100k = new GptTokenizerEstimator("cl100k_base").estimate(text);
    const o200k = new GptTokenizerEstimator("o200k_base").estimate(text);
    expect(cl100k).toBeGreaterThan(0);
    expect(o200k).toBeGreaterThan(0);
  });

  it("longer text tokenizes to more tokens than shorter text", () => {
    const estimator = new GptTokenizerEstimator();
    const short = estimator.estimate("hello world");
    const long = estimator.estimate("hello world ".repeat(50));
    expect(long).toBeGreaterThan(short);
  });
});
