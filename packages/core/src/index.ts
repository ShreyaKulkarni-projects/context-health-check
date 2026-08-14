export * from "./types.js";
export { ConversationAnalyzer, analyze } from "./analyzer.js";
export { median, computeBloatThreshold, detectBloat } from "./bloat.js";
export type { BloatResult } from "./bloat.js";
export { shingles, jaccard, detectRedundancy } from "./redundancy.js";
export { clamp, riskZoneFor, computeScore } from "./score.js";
export { buildRecommendations } from "./recommendations.js";
export type { RecommendationInput } from "./recommendations.js";
export { CharHeuristicEstimator, charHeuristicEstimator } from "./tokenizers/charHeuristic.js";
// GptTokenizerEstimator is intentionally NOT re-exported here: it pulls in
// gpt-tokenizer's full BPE vocab tables (multi-MB), which would make every
// consumer of the main entry point (web-demo's single-file bundle, the
// extension) pay that cost even if they only ever use the zero-dependency
// char-heuristic default. Import it explicitly from
// "@context-health/core/gpt-tokenizer" when you actually want it.
export { AnthropicApiEstimator } from "./tokenizers/anthropicApi.js";
export type { AnthropicApiEstimatorOptions } from "./tokenizers/anthropicApi.js";
export { THEME } from "./constants/theme.js";
export type { ThemeMode } from "./constants/theme.js";
