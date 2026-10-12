import { smokeTest } from "./smoke-test";

/**
 * Task registry (Build pack section 6). One entry per task: model, prompt version,
 * input and output schemas, token limit, timeout, cache key and manual fallback step.
 * Model choices follow the pack: Haiku for parsing, extraction, classification and
 * email packs; Sonnet for the fit verdict, CV tailoring, Shortlist questions and
 * drill feedback.
 */
export const TASKS = {
  smoke_test: smokeTest,
} as const;

export type TaskName = keyof typeof TASKS;
