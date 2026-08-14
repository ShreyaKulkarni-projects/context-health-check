import type { RedundantPair } from "./types.js";

const REDUNDANCY_MIN_TOKENS = 300;
const SHINGLE_SIZE = 16;
const SHINGLE_STRIDE = 8;
const SIMILARITY_THRESHOLD = 0.45;

export function shingles(text: string, size: number = SHINGLE_SIZE, stride: number = SHINGLE_STRIDE): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const set = new Set<string>();
  for (let i = 0; i + size <= normalized.length; i += Math.max(1, stride)) {
    set.add(normalized.slice(i, i + size));
  }
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Compares every pair of turns with >300 tokens via Jaccard similarity over
 * 16-char/stride-8 shingles, flagging pairs above 0.45 similarity as redundant
 * re-pastes. O(n^2) in candidate count by design — see ConversationAnalyzer
 * for how incremental mode avoids re-running this over the full history.
 */
export function detectRedundancy(
  texts: string[],
  tokenCounts: number[],
): RedundantPair[] {
  const candidateIndices = texts
    .map((_, i) => i)
    .filter((i) => tokenCounts[i] > REDUNDANCY_MIN_TOKENS);

  const shingleCache = new Map<number, Set<string>>();
  const getShingles = (i: number): Set<string> => {
    let s = shingleCache.get(i);
    if (!s) {
      s = shingles(texts[i]);
      shingleCache.set(i, s);
    }
    return s;
  };

  const pairs: RedundantPair[] = [];
  for (let x = 0; x < candidateIndices.length; x++) {
    for (let y = x + 1; y < candidateIndices.length; y++) {
      const i = candidateIndices[x];
      const j = candidateIndices[y];
      const similarity = jaccard(getShingles(i), getShingles(j));
      if (similarity > SIMILARITY_THRESHOLD) {
        pairs.push({ a: i, b: j, similarity });
      }
    }
  }
  return pairs;
}
