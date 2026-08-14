import type { TokenEstimator } from "../types.js";

/**
 * Default, zero-dependency estimator: ~4 characters per token.
 * Transparent, offline, no network call. Matches the validated HTML prototype.
 */
export class CharHeuristicEstimator implements TokenEstimator {
  readonly id = "char-heuristic";

  estimate(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}

export const charHeuristicEstimator = new CharHeuristicEstimator();
