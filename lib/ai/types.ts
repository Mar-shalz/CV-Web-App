import type { z } from "zod";
import type pricing from "@/config/ai_pricing.json";

/** Models the Build pack allows (section 3): Haiku for parsing and extraction, Sonnet for judgement. */
export type AiModel = keyof typeof pricing.models;
export type AiEffort = "low" | "medium" | "high";

/**
 * A piece of the user message. Trusted text is written by us. Untrusted text came from
 * outside our control (job posts, CVs, transcripts, pasted messages) and is always
 * wrapped in delimiters the model is told never to take instructions from.
 */
export type AttachmentMediaType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export type PromptPart =
  | { kind: "trusted"; text: string }
  | { kind: "untrusted"; label: string; text: string }
  /** A user supplied file (a CV PDF, a photo of a printed CV, a job flyer). Always untrusted. */
  | { kind: "file"; label: string; mediaType: AttachmentMediaType; base64: string };

export const trusted = (text: string): PromptPart => ({ kind: "trusted", text });
export const untrusted = (label: string, text: string): PromptPart => ({ kind: "untrusted", label, text });
export const untrustedFile = (label: string, mediaType: AttachmentMediaType, base64: string): PromptPart => ({
  kind: "file",
  label,
  mediaType,
  base64,
});

export type AiTask<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> = {
  name: string;
  model: AiModel;
  /** File at prompts/<name>/<promptVersion>.md. Bump the version for any wording change. */
  promptVersion: `v${number}`;
  input: I;
  output: O;
  /** Output token ceiling. Thinking counts toward it. */
  maxTokens: number;
  /** Per attempt. A timed out attempt counts as one of the two allowed. */
  timeoutMs: number;
  effort?: AiEffort;
  render: (input: z.output<I>) => PromptPart[];
  /** Raw key material (a file hash, a post hash). Hashed with task, model and prompt version before use. */
  cache: { key: (input: z.output<I>) => string; ttlSeconds: number } | null;
  /** The manual step the screen falls back to when this task fails, for example "type_job_details". */
  manualStep: string;
  /**
   * Fixes small slips in the model's reply before it is checked (a year without a month, a
   * line a little too long), so a good read isn't thrown away for them. Never adds content.
   */
  repair?: (raw: unknown) => unknown;
};

/** Identity helper that keeps the input and output types attached to a task definition. */
export function defineTask<I extends z.ZodType, O extends z.ZodType>(task: AiTask<I, O>): AiTask<I, O> {
  return task;
}

export type FallbackReason =
  | "invalid_input"
  | "invalid_output"
  | "refusal"
  | "too_long"
  | "timeout"
  | "provider_error";

export type AiMeta = {
  task: string;
  model: AiModel;
  promptVersion: string;
  attempts: number;
  cached: boolean;
  latencyMs: number;
  costUsd: number;
};

/**
 * Every call ends in validated data or a typed manual path. There is no branch that
 * carries model text the schema rejected.
 */
export type AiResult<T> =
  | { ok: true; data: T; meta: AiMeta }
  | { ok: false; fallback: { kind: "manual"; step: string; reason: FallbackReason }; meta: AiMeta };
