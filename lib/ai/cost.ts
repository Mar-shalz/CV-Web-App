import pricing from "@/config/ai_pricing.json";
import type { AiModel } from "./types";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export const PRICING_VERSION = pricing.version;

/** US dollars for one call, from the versioned price list in config/ai_pricing.json. */
export function costUsd(model: AiModel, usage: TokenUsage): number {
  const base = pricing.models[model];
  const promptTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const rates = "long_context" in base && promptTokens > base.long_context.above_input_tokens ? base.long_context : base;
  const micro =
    usage.inputTokens * rates.input +
    usage.outputTokens * rates.output +
    usage.cacheWriteTokens * rates.cache_write +
    usage.cacheReadTokens * rates.cache_read;
  return Math.round(micro * 100) / 1e8;
}
