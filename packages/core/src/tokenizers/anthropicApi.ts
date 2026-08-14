import type { TokenEstimator } from "../types.js";

export interface AnthropicApiEstimatorOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Opt-in, exact-count estimator for Claude models via Anthropic's `count_tokens`
 * endpoint. Requires a user-supplied API key and makes a network call directly
 * to Anthropic — never through any server of ours, because there is no server
 * of ours. Off by default; the default experience (CharHeuristicEstimator)
 * works fully offline with zero keys and zero network calls.
 *
 * Note: `estimate()` on the shared TokenEstimator interface is synchronous, so
 * this class exposes an async `estimateAsync()` instead. Callers that want
 * exact Claude counts should call `estimateAsync()` directly rather than going
 * through the synchronous `analyze()`/`ConversationAnalyzer` path.
 */
export class AnthropicApiEstimator {
  readonly id = "anthropic-api";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicApiEstimatorOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "claude-sonnet-4-5";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async estimateAsync(text: string): Promise<number> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages/count_tokens", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic count_tokens failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { input_tokens: number };
    return data.input_tokens;
  }
}
