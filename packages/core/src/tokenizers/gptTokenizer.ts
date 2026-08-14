import { encode as encodeCl100k } from "gpt-tokenizer/model/gpt-4";
import { encode as encodeO200k } from "gpt-tokenizer/model/gpt-4o";
import type { TokenEstimator } from "../types.js";

export type GptEncoding = "cl100k_base" | "o200k_base";

/**
 * Higher-accuracy estimator for GPT-family models via the `gpt-tokenizer` package
 * (MIT licensed, browser-safe, no network call). Opt-in: the default estimator
 * is CharHeuristicEstimator so the product works fully offline out of the box.
 */
export class GptTokenizerEstimator implements TokenEstimator {
  readonly id: string;
  private readonly encoding: GptEncoding;

  constructor(encoding: GptEncoding = "o200k_base") {
    this.encoding = encoding;
    this.id = `gpt-tokenizer:${encoding}`;
  }

  estimate(text: string): number {
    const encode = this.encoding === "o200k_base" ? encodeO200k : encodeCl100k;
    return Math.max(1, encode(text).length);
  }
}
