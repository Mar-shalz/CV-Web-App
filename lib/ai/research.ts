import "server-only";
import { chainProvider } from "./chain";
import { consoleLogger } from "./log";
import { costUsd, PRICING_VERSION } from "./cost";
import { systemPrompt } from "./prompt";
import { ProviderError, type ResearchSource } from "./provider";
import { pseudonymousId } from "@/lib/analytics/server";
import type { AiModel } from "./types";

export type ResearchResult = { ok: true; notes: string; sources: ResearchSource[]; searches: number } | { ok: false };

/**
 * The web search step of the legitimacy lookup (the only task with a tool). Returns
 * free text notes for the structuring task and the sources the search tool really
 * returned. Logged like every other model call.
 */
export async function runResearch(input: { name: string; model: AiModel; user: string; maxSearches: number; userId?: string }): Promise<ResearchResult> {
  const opts = process.env.AI_BUDGET_MODE === "haiku" ? { ...input, model: "claude-haiku-5-5" as const, maxSearches: Math.min(input.maxSearches, 2) } : input;
  const sys = systemPrompt({ name: opts.name, promptVersion: "v1" });
  const started = Date.now();
  if (!chainProvider.research) return { ok: false };
  try {
    const res = await chainProvider.research({ model: opts.model, system: sys.text, user: opts.user, maxTokens: 6000, timeoutMs: 45_000, maxSearches: opts.maxSearches });
    consoleLogger({
      event: "ai_call",
      task: opts.name,
      model: opts.model,
      prompt_version: "v1",
      prompt_hash: sys.hash,
      pricing_version: PRICING_VERSION,
      attempt: 1,
      outcome: res.stopReason === "refusal" ? "refusal" : "ok",
      latency_ms: Date.now() - started,
      input_tokens: res.usage.inputTokens,
      output_tokens: res.usage.outputTokens,
      cache_read_tokens: res.usage.cacheReadTokens,
      cache_write_tokens: res.usage.cacheWriteTokens,
      cost_usd: costUsd(opts.model, res.usage),
      user_ref: opts.userId ? pseudonymousId(opts.userId) : null,
      request_id: res.requestId,
    });
    if (res.stopReason === "refusal") return { ok: false };
    return { ok: true, notes: res.notes.slice(0, 12_000), sources: res.sources.slice(0, 30), searches: res.searches };
  } catch (error) {
    const kind = error instanceof ProviderError ? error.kind : "fatal";
    consoleLogger({
      event: "ai_call",
      task: opts.name,
      model: opts.model,
      prompt_version: "v1",
      prompt_hash: sys.hash,
      pricing_version: PRICING_VERSION,
      attempt: 1,
      outcome: kind === "timeout" ? "timeout" : "provider_error",
      latency_ms: Date.now() - started,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
      user_ref: opts.userId ? pseudonymousId(opts.userId) : null,
      request_id: null,
    });
    return { ok: false };
  }
}
