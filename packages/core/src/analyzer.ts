import { computeBloatThreshold } from "./bloat.js";
import { buildRecommendations } from "./recommendations.js";
import { jaccard, shingles } from "./redundancy.js";
import { computeScore, riskZoneFor } from "./score.js";
import { charHeuristicEstimator } from "./tokenizers/charHeuristic.js";
import type {
  AnalysisResult,
  AnalyzeOptions,
  AnalyzedTurn,
  ConversationTurn,
  RedundantPair,
  TokenEstimator,
} from "./types.js";
import { DEFAULT_CONTEXT_WINDOW } from "./types.js";

const REDUNDANCY_MIN_TOKENS = 300;
const SIMILARITY_THRESHOLD = 0.45;

/**
 * Stateful, incremental scoring engine. `addTurn()` updates running totals and
 * returns the new AnalysisResult without re-processing the whole transcript
 * from scratch: redundancy detection only compares the newly added turn
 * against previously-seen candidates (cached shingle sets), rather than
 * re-running the full O(n^2) pairwise comparison on every call. This is what
 * makes it safe to call on every DOM mutation in the extension.
 *
 * Bloat detection still recomputes the threshold from the full token-count
 * history on each call (the median can shift as new turns arrive), which is
 * O(n) per call - cheap compared to redundancy's pairwise comparison.
 */
export class ConversationAnalyzer {
  private readonly contextWindow: number;
  private readonly tokenEstimator: TokenEstimator;

  private turns: ConversationTurn[] = [];
  private tokenCounts: number[] = [];
  private cumulativeTokens: number[] = [];
  private redundancyCandidates: number[] = [];
  private shingleCache = new Map<number, Set<string>>();
  private redundantPairs: RedundantPair[] = [];

  constructor(options: AnalyzeOptions = {}) {
    this.contextWindow = options.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
    this.tokenEstimator = options.tokenEstimator ?? charHeuristicEstimator;
  }

  addTurn(turn: ConversationTurn): AnalysisResult {
    const index = this.turns.length;
    const tokens = this.tokenEstimator.estimate(turn.text);

    this.turns.push(turn);
    this.tokenCounts.push(tokens);
    const running = (this.cumulativeTokens.at(-1) ?? 0) + tokens;
    this.cumulativeTokens.push(running);

    if (tokens > REDUNDANCY_MIN_TOKENS) {
      const newShingles = shingles(turn.text);
      this.shingleCache.set(index, newShingles);
      for (const candidateIndex of this.redundancyCandidates) {
        const similarity = jaccard(this.shingleCache.get(candidateIndex)!, newShingles);
        if (similarity > SIMILARITY_THRESHOLD) {
          this.redundantPairs.push({ a: candidateIndex, b: index, similarity });
        }
      }
      this.redundancyCandidates.push(index);
    }

    return this.getResult();
  }

  getResult(): AnalysisResult {
    const bloatThreshold = computeBloatThreshold(this.tokenCounts);
    const totalTokens = this.tokenCounts.reduce((a, b) => a + b, 0);

    let bloatTokens = 0;
    let bloatCount = 0;
    const analyzedTurns: AnalyzedTurn[] = this.turns.map((turn, i) => {
      const tokens = this.tokenCounts[i];
      const bloat = tokens > bloatThreshold;
      if (bloat) {
        bloatTokens += tokens;
        bloatCount += 1;
      }
      return {
        ...turn,
        index: i,
        tokens,
        bloat,
        cumulativeTokens: this.cumulativeTokens[i],
      };
    });
    const bloatRatio = totalTokens > 0 ? bloatTokens / totalTokens : 0;

    const peakUsagePct = this.contextWindow > 0 ? (totalTokens / this.contextWindow) * 100 : 0;
    const score = computeScore(peakUsagePct, bloatRatio, this.redundantPairs.length);
    const recommendations = buildRecommendations({
      turnCount: this.turns.length,
      peakUsagePct,
      bloat: { bloatThreshold, bloatFlags: analyzedTurns.map((t) => t.bloat), bloatCount, bloatTokens, bloatRatio },
      redundantPairs: this.redundantPairs,
    });

    return {
      turns: analyzedTurns,
      totalTokens,
      peakUsagePct,
      contextWindow: this.contextWindow,
      bloatRatio,
      bloatCount,
      bloatThreshold,
      redundantPairs: [...this.redundantPairs],
      riskZone: riskZoneFor(peakUsagePct),
      score,
      recommendations,
    };
  }

  reset(): void {
    this.turns = [];
    this.tokenCounts = [];
    this.cumulativeTokens = [];
    this.redundancyCandidates = [];
    this.shingleCache.clear();
    this.redundantPairs = [];
  }
}

/**
 * One-shot convenience wrapper for callers without persistent state (MCP
 * tools, web-demo's paste-and-analyze flow). Built on ConversationAnalyzer so
 * there is exactly one implementation of the algorithm.
 */
export function analyze(turns: ConversationTurn[], options: AnalyzeOptions = {}): AnalysisResult {
  const analyzer = new ConversationAnalyzer(options);
  for (const turn of turns) {
    analyzer.addTurn(turn);
  }
  return analyzer.getResult();
}
