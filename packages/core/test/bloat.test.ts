import { describe, expect, it } from "vitest";
import { computeBloatThreshold, detectBloat, median } from "../src/bloat.js";

describe("median", () => {
  it("returns 0 for an empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the middle value for an odd-length array", () => {
    expect(median([1, 3, 2])).toBe(2);
  });

  it("averages the two middle values for an even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("computeBloatThreshold", () => {
  it("floors at 800 when median * 3 is below 800", () => {
    expect(computeBloatThreshold([100, 100, 100])).toBe(800);
  });

  it("uses median * 3 when it exceeds the 800 floor", () => {
    expect(computeBloatThreshold([1000, 1000, 1000])).toBe(3000);
  });
});

describe("detectBloat", () => {
  it("flags turns synthetically constructed to exceed the threshold", () => {
    // median of [100,100,100,5000] is 100 -> threshold 800 (floor)
    const counts = [100, 100, 100, 5000];
    const result = detectBloat(counts);
    expect(result.bloatThreshold).toBe(800);
    expect(result.bloatFlags).toEqual([false, false, false, true]);
    expect(result.bloatCount).toBe(1);
    expect(result.bloatRatio).toBeCloseTo(5000 / 5300, 5);
  });

  it("flags no turns when nothing exceeds the threshold", () => {
    const counts = [200, 250, 300, 275];
    const result = detectBloat(counts);
    expect(result.bloatCount).toBe(0);
    expect(result.bloatRatio).toBe(0);
  });

  it("handles an empty turn set", () => {
    const result = detectBloat([]);
    expect(result.bloatCount).toBe(0);
    expect(result.bloatRatio).toBe(0);
    expect(result.bloatThreshold).toBe(800);
  });
});
