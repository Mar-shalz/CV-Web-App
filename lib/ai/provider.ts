import type { TokenUsage } from "./cost";
import type { AiEffort, AiModel } from "./types";

export type ProviderRequest = {
  model: AiModel;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  effort?: AiEffort;
  /** JSON schema the reply must follow (structured outputs). */
  jsonSchema: Record<string, unknown>;
};

export type StopReason = "end_turn" | "max_tokens" | "refusal" | "context_exceeded" | "other";

export type ProviderResponse = {
  /** Text blocks joined. Thinking blocks are never returned here. */
  text: string;
  stopReason: StopReason;
  usage: TokenUsage;
  requestId: string | null;
};

/**
 * Provider failures, reduced to what the retry rule needs. Carries no request or
 * response text, so it is safe to log and report.
 */
export class ProviderError extends Error {
  constructor(
    readonly kind: "timeout" | "transient" | "fatal",
    readonly status: number | null = null,
  ) {
    super(`AI provider ${kind} error${status ? ` (HTTP ${status})` : ""}`);
    this.name = "ProviderError";
  }
}

/** The only thing lib/ai needs from a model vendor. Tests swap in a fake. */
export interface AiProvider {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}
