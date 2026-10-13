import { createHash } from "node:crypto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { NO_USAGE, PRICING_VERSION, costUsd, type TokenUsage } from "./cost";
import { usageFields, type AiCallLog, type AiLogger, type AiOutcome } from "./log";
import { newNonce, renderUserMessage, systemPrompt, validationFeedback } from "./prompt";
import { ProviderError, type AiProvider } from "./provider";
import type { AiMeta, AiResult, AiTask, FallbackReason } from "./types";

/** A shared store for task results (Build pack section 6, Cache column). Values are re-validated on read. */
export interface AiCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export type AiDeps = {
  provider: AiProvider;
  log: AiLogger;
  cache?: AiCache | null;
  /** Errors worth a human look (bad input from our own code, fatal provider errors). Never given user text. */
  reportError?: (error: Error, context: Record<string, string>) => void;
  nonce?: () => string;
  now?: () => number;
  promptRoot?: string;
};

export type RunOptions = {
  /** Salted hash from pseudonymousId(), never a raw id. */
  userRef?: string | null;
};

const MAX_ATTEMPTS = 2;
const MAX_PROBLEMS = 10;

const schemaCache = new WeakMap<z.ZodType, Record<string, unknown>>();

/** JSON schema for structured outputs. The SDK helper strips constraints the API can't enforce; zod still checks them. */
function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  let json = schemaCache.get(schema);
  if (!json) {
    json = zodOutputFormat(schema).schema;
    schemaCache.set(schema, json);
  }
  return json;
}

/**
 * Checks the reply against the task's output schema. Problems name schema paths and
 * rules only, never the rejected values, so they are safe to send back and to count.
 */
function check<O extends z.ZodType>(
  schema: O,
  text: string,
  cutOff: boolean,
): { ok: true; data: z.output<O> } | { ok: false; problems: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      problems: [
        cutOff
          ? "the reply was cut off at the token limit before the JSON was complete; keep every field shorter"
          : "the reply was not a single valid JSON object",
      ],
    };
  }
  const result = schema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    problems: result.error.issues
      .slice(0, MAX_PROBLEMS)
      .map((issue) => `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`),
  };
}

function cacheKey(task: AiTask, promptHash: string, material: string): string {
  return createHash("sha256")
    .update([task.name, task.model, task.promptVersion, promptHash, material].join("\u0000"))
    .digest("hex");
}

/**
 * Runs one AI task: validate input, call the model with structured output, validate
 * the reply, retry once with the validation problems attached, and fall back to the
 * manual step on a second failure. Never returns text the schema rejected.
 */
export async function runAiTask<I extends z.ZodType, O extends z.ZodType>(
  task: AiTask<I, O>,
  rawInput: z.input<I>,
  deps: AiDeps,
  options: RunOptions = {},
): Promise<AiResult<z.output<O>>> {
  const now = deps.now ?? Date.now;
  const nonce = deps.nonce ?? newNonce;
  const started = now();
  const userRef = options.userRef ?? null;
  let totalCost = 0;
  let attempts = 0;

  const meta = (cached = false): AiMeta => ({
    task: task.name,
    model: task.model,
    promptVersion: task.promptVersion,
    attempts,
    cached,
    latencyMs: now() - started,
    costUsd: Math.round(totalCost * 1e8) / 1e8,
  });
  const fallback = (reason: FallbackReason): AiResult<z.output<O>> => ({
    ok: false,
    fallback: { kind: "manual", step: task.manualStep, reason },
    meta: meta(),
  });

  let promptHash = "";
  let servedModel: string | undefined;
  const record = (
    attempt: number,
    outcome: AiOutcome,
    latencyMs: number,
    usage: TokenUsage,
    cost: number,
    requestId: string | null,
    problems?: number,
  ) => {
    const line: AiCallLog = {
      event: "ai_call",
      task: task.name,
      model: servedModel ?? task.model,
      prompt_version: task.promptVersion,
      prompt_hash: promptHash,
      pricing_version: PRICING_VERSION,
      attempt,
      outcome,
      latency_ms: latencyMs,
      ...usageFields(usage),
      cost_usd: cost,
      user_ref: userRef,
      request_id: requestId,
      ...(problems === undefined ? {} : { problems }),
    };
    try {
      deps.log(line);
    } catch {
      // Logging must never break a user flow.
    }
  };
  const report = (error: Error, extra: Record<string, string> = {}) => {
    try {
      deps.reportError?.(error, { task: task.name, model: task.model, prompt_version: task.promptVersion, ...extra });
    } catch {
      // Same rule as logging.
    }
  };

  const input = task.input.safeParse(rawInput);
  if (!input.success) {
    // Our own code passed bad data. Paths only: the values may be personal.
    const paths = input.error.issues.map((i) => i.path.join(".") || "(root)").join(", ");
    report(new Error(`Invalid input for AI task ${task.name}: ${paths}`));
    record(0, "invalid_input", 0, NO_USAGE, 0, null);
    return fallback("invalid_input");
  }

  const system = systemPrompt(task, deps.promptRoot);
  promptHash = system.hash;
  const jsonSchema = jsonSchemaFor(task.output);
  const parts = task.render(input.data);
  const attachments = parts.flatMap((p) => (p.kind === "file" ? [{ mediaType: p.mediaType, base64: p.base64 }] : []));

  const key = task.cache && deps.cache ? cacheKey(task, system.hash, task.cache.key(input.data)) : null;
  if (key && deps.cache) {
    try {
      const hit = task.output.safeParse(await deps.cache.get(key));
      if (hit.success) {
        record(0, "cache_hit", now() - started, NO_USAGE, 0, null);
        return { ok: true, data: hit.data, meta: meta(true) };
      }
    } catch {
      // A cache outage means a model call, not a failure.
    }
  }

  let problems: string[] = [];
  let lastReason: FallbackReason = "invalid_output";

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    const attemptStart = now();
    const user = problems.length
      ? `${renderUserMessage(parts, nonce())}\n\n${validationFeedback(problems)}`
      : renderUserMessage(parts, nonce());

    let response;
    try {
      response = await deps.provider.complete({
        model: task.model,
        system: system.text,
        user,
        maxTokens: task.maxTokens,
        timeoutMs: task.timeoutMs,
        effort: task.effort,
        jsonSchema,
        ...(attachments.length ? { attachments } : {}),
      });
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError("fatal");
      const outcome: AiOutcome = providerError.kind === "timeout" ? "timeout" : "provider_error";
      record(attempts, outcome, now() - attemptStart, NO_USAGE, 0, null);
      lastReason = outcome;
      if (providerError.kind === "fatal") {
        report(providerError, { status: String(providerError.status ?? "none") });
        return fallback(lastReason);
      }
      // Timeouts and transient errors use the retry without feedback.
      problems = [];
      continue;
    }

    servedModel = response.servedModel;
    const cost = response.costUsd ?? costUsd(task.model, response.usage);
    totalCost += cost;
    const latency = now() - attemptStart;

    if (response.stopReason === "refusal") {
      record(attempts, "refusal", latency, response.usage, cost, response.requestId);
      return fallback("refusal");
    }
    if (response.stopReason === "context_exceeded") {
      record(attempts, "too_long", latency, response.usage, cost, response.requestId);
      return fallback("too_long");
    }

    const checked = check(task.output, response.text, response.stopReason === "max_tokens");
    if (checked.ok) {
      record(attempts, "ok", latency, response.usage, cost, response.requestId);
      if (key && deps.cache && task.cache) {
        try {
          await deps.cache.set(key, checked.data, task.cache.ttlSeconds);
        } catch {
          // The result is still good without the cache.
        }
      }
      return { ok: true, data: checked.data, meta: meta() };
    }

    record(attempts, "invalid_output", latency, response.usage, cost, response.requestId, checked.problems.length);
    problems = checked.problems;
    lastReason = "invalid_output";
  }

  return fallback(lastReason);
}
