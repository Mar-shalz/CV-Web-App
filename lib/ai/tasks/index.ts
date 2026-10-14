import { smokeTest } from "./smoke-test";
import { parseCv } from "./parse-cv";
import { extractItems, interviewNextQuestion } from "./interview";
import { parseJob } from "./parse-job";
import { legitimacyLookup } from "./legitimacy";
import { fitVerdict } from "./fit-verdict";
import { tailorCv } from "./tailor-cv";
import { buildPack } from "./build-pack";
import { classifyOutcome, extractDebrief } from "./outcomes";
import { shortlistQuestions, drillFeedback, interviewResearch } from "./shortlist";
import { polishAchievement } from "./polish";
import { cvTarget } from "./cv-target";

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
  tailor_cv: tailorCv,
  build_pack: buildPack,
  classify_outcome: classifyOutcome,
  extract_debrief: extractDebrief,
  shortlist_questions: shortlistQuestions,
  drill_feedback: drillFeedback,
  interview_research: interviewResearch,
  polish_achievement: polishAchievement,
  cv_target: cvTarget,
} as const;

export type TaskName = keyof typeof TASKS;
