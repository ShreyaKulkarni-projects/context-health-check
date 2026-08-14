export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeBloatThreshold(tokenCounts: number[]): number {
  return Math.max(800, median(tokenCounts) * 3);
}

export interface BloatResult {
  bloatThreshold: number;
  bloatFlags: boolean[];
  bloatCount: number;
  bloatTokens: number;
  bloatRatio: number;
}

export function detectBloat(tokenCounts: number[]): BloatResult {
  const bloatThreshold = computeBloatThreshold(tokenCounts);
  const bloatFlags = tokenCounts.map((t) => t > bloatThreshold);
  const bloatCount = bloatFlags.filter(Boolean).length;
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
  const bloatTokens = tokenCounts.reduce((sum, t, i) => (bloatFlags[i] ? sum + t : sum), 0);
  const bloatRatio = totalTokens > 0 ? bloatTokens / totalTokens : 0;
  return { bloatThreshold, bloatFlags, bloatCount, bloatTokens, bloatRatio };
}
