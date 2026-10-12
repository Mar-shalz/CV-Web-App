import type { TokenUsage } from "./cost";

export type AiOutcome =
  | "ok"
  | "cache_hit"
  | "invalid_input"
  | "invalid_output"
  | "refusal"
  | "too_long"
  | "timeout"
  | "provider_error";

/**
 * One line per model attempt (Build pack section 6: cost, latency, model and prompt
 * version for every call). Holds no input or output text and no direct identifier:
 * user_ref is the same salted hash analytics uses, so cost per active user can be
 * counted without knowing who the user is.
 */
export type AiCallLog = {
  event: "ai_call";
  task: string;
  model: string;
  prompt_version: string;
  prompt_hash: string;
  pricing_version: string;
  attempt: number;
  outcome: AiOutcome;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
  user_ref: string | null;
  request_id: string | null;
  /** Count of schema problems on an invalid_output attempt. */
  problems?: number;
};

export type AiLogger = (record: AiCallLog) => void;

export function usageFields(usage: TokenUsage) {
  return {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cache_read_tokens: usage.cacheReadTokens,
    cache_write_tokens: usage.cacheWriteTokens,
  };
}

/** Structured stdout line. The host's log drain keeps it until the cost report table lands. */
export const consoleLogger: AiLogger = (record) => {
  console.info(JSON.stringify(record));
};
