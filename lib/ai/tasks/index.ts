import { smokeTest } from "./smoke-test";
import { parseCv } from "./parse-cv";
import { extractItems, interviewNextQuestion } from "./interview";
import { parseJob } from "./parse-job";
import { legitimacyLookup } from "./legitimacy";
import { fitVerdict } from "./fit-verdict";

/**
 * Task registry (Build pack section 6). One entry per task: model, prompt version,
 * input and output schemas, token limit, timeout, cache key and manual fallback step.
 * Model choices follow the pack: Haiku for parsing, extraction, classification and
 * email packs; Sonnet for the fit verdict, CV tailoring, Shortlist questions and
 * drill feedback.
 */
export const TASKS = {
  smoke_test: smokeTest,
  parse_cv: parseCv,
  interview_next_question: interviewNextQuestion,
  extract_items: extractItems,
  parse_job: parseJob,
  legitimacy_lookup: legitimacyLookup,
  fit_verdict: fitVerdict,
} as const;

export type TaskName = keyof typeof TASKS;
