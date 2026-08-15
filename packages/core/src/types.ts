export type Speaker = "user" | "assistant";

export interface ConversationTurn {
  speaker: Speaker;
  text: string;
  timestamp?: number;
}

export interface AnalyzedTurn extends ConversationTurn {
  index: number;
  tokens: number;
  bloat: boolean;
  cumulativeTokens: number;
}

export interface RedundantPair {
  a: number;
  b: number;
  similarity: number;
}

export type RiskZoneKey = "good" | "warning" | "serious" | "critical";

export interface RiskZone {
  key: RiskZoneKey;
  /** CSS custom property reference, e.g. "var(--status-good)" */
  colorVar: string;
}

export type GradeKey = "good" | "warning" | "serious" | "critical";

export interface Grade {
  key: GradeKey;
  label: string;
  colorVar: string;
}

export interface ScoreBreakdown {
  score: number;
  grade: Grade;
  usagePenalty: number;
  bloatPenalty: number;
  redundancyPenalty: number;
}

export type RecommendationIcon = "clock" | "broom" | "loop" | "note" | "check";

export interface Recommendation {
  id:
    | "high-usage"
    | "high-bloat"
    | "redundant-pastes"
    | "consider-compaction"
    | "good-shape";
  icon: RecommendationIcon;
  colorVar: string;
  title: string;
  /** Short summary - what fired and the headline number, one or two sentences. */
  description: string;
  /** Why this is happening in THIS conversation, specifically. */
  why: string;
  /** Concrete, ordered steps to fix it. */
  how: string[];
  /** What changes once you've done it. */
  impact: string;
}

export interface AnalysisResult {
  turns: AnalyzedTurn[];
  totalTokens: number;
  peakUsagePct: number;
  contextWindow: number;
  bloatRatio: number;
  bloatCount: number;
  bloatThreshold: number;
  redundantPairs: RedundantPair[];
  riskZone: RiskZone;
  score: ScoreBreakdown;
  recommendations: Recommendation[];
}

export interface TokenEstimator {
  /** Human-readable id, e.g. "char-heuristic", "gpt-tokenizer", "anthropic-api" */
  readonly id: string;
  estimate(text: string): number;
}

export interface AnalyzeOptions {
  contextWindow?: number;
  tokenEstimator?: TokenEstimator;
}

export const DEFAULT_CONTEXT_WINDOW = 200_000;
