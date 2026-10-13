import type { TokenUsage } from "./cost";
import type { AiEffort, AiModel, AttachmentMediaType } from "./types";

/** Files sent ahead of the text, in order. Their content is untrusted input. */
export type ProviderAttachment = { mediaType: AttachmentMediaType; base64: string };

export type ProviderRequest = {
  model: AiModel;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  effort?: AiEffort;
  /** JSON schema the reply must follow (structured outputs). */
  jsonSchema: Record<string, unknown>;
  attachments?: ProviderAttachment[];
};

/**
 * A web search step (legitimacy lookup only, Build pack section 6). Free text notes
 * plus the sources the search tool actually returned. The notes are never shown to
 * users: a second, schema validated task turns them into findings.
 */
export type ResearchRequest = {
  model: AiModel;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  maxSearches: number;
};

export type ResearchSource = { url: string; title: string };

export type ResearchResponse = {
  notes: string;
  sources: ResearchSource[];
  stopReason: StopReason;
  usage: TokenUsage;
  searches: number;
  requestId: string | null;
};

export type StopReason = "end_turn" | "max_tokens" | "refusal" | "context_exceeded" | "other";

export type ProviderResponse = {
  /** Text blocks joined. Thinking blocks are never returned here. */
  text: string;
  stopReason: StopReason;
  usage: TokenUsage;
  requestId: string | null;
  /** The model that actually answered, when a provider maps ours to its own. */
  servedModel?: string;
  /** Set when the provider knows the price better than our table (a free tier is 0). */
  costUsd?: number;
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
  research?(request: ResearchRequest): Promise<ResearchResponse>;
}
