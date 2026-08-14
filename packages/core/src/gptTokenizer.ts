/**
 * Separate entry point for the optional, higher-accuracy GPT-family token
 * estimator. Kept out of the main "@context-health/core" barrel so that
 * consumers who only need the default char-heuristic estimator (the common
 * case) don't pay for gpt-tokenizer's multi-megabyte vocab tables in their
 * bundle. Import from "@context-health/core/gpt-tokenizer" instead.
 */
export { GptTokenizerEstimator } from "./tokenizers/gptTokenizer.js";
export type { GptEncoding } from "./tokenizers/gptTokenizer.js";
