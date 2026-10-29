import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * shortlist_questions (Build pack section 6): likely questions, why each is likely, and
 * the linked bullet id from the CV that was actually sent. Code drops any question whose
 * bullet id isn't in that CV.
 */
export const shortlistQuestions = defineTask({
  name: "shortlist_questions",
  model: "claude-sonnet-5-5",
  promptVersion: "v3",
  input: z.object({
    job: z.object({ title: z.string(), employer: z.string(), level: z.string().max(60).optional(), requirements: z.array(z.string().max(300)).max(20), post: z.string().max(8000) }),
    bullets: z.array(z.object({ id: z.string(), role: z.string(), text: z.string().max(400) })).min(1).max(40),
    format: z.string(),
  }),
  output: z.object({
    questions: z
      .array(
        z.object({
          question: z.string().min(8).max(240),
          why: z.string().max(240),
          bullet_id: z.string().nullable(),
          kind: z.enum(["defend_cv", "job_fit", "situational", "technical", "standard"]),
        }),
      )
      .min(1)
      .max(20),
  }),
  // Quality first (founder, round 28).
  maxTokens: 9000,
  timeoutMs: 75_000,
  effort: "medium",
  render: (i) => [
    trusted(`Interview for ${i.job.title} at ${i.job.employer}. Level: ${i.job.level ?? "not stated"}. Format: ${i.format}.`),
    untrusted("cv_sent", i.bullets.map((b) => `[${b.id}] (${b.role}) ${b.text}`).join("\n")),
    untrusted("job_post", `Requirements:\n${i.job.requirements.map((r) => `- ${r}`).join("\n")}\n\nPost:\n${i.job.post}`),
  ],
  cache: null,
  manualStep: "practise_from_cv",
});

/**
 * drill_feedback (Build pack section 6): whether the answer matches the CV, issues, and a
 * stronger answer as points only. Never a script to memorise, never a new fact.
 */
export const drillFeedback = defineTask({
  name: "drill_feedback",
  model: "claude-sonnet-5-5",
  promptVersion: "v2",
  input: z.object({
    question: z.string().max(240),
    answer: z.string().min(1).max(6000),
    bullet: z.object({ text: z.string().max(400), facts: z.array(z.string().max(600)).max(8) }),
  }),
  output: z.object({
    matches_cv: z.enum(["yes", "partly", "no"]),
    issues: z.array(z.object({ type: z.enum(["contradicts_cv", "missing_result", "vague", "too_long", "off_question", "new_claim"]), detail: z.string().max(240) })).max(5),
    stronger_points: z.array(z.string().max(200)).min(1).max(5),
    did_well: z.string().max(200).nullable(),
  }),
  maxTokens: 2500,
  timeoutMs: 30_000,
  effort: "medium",
  render: (i) => [
    trusted(`Question: ${i.question}`),
    untrusted("cv_line", i.bullet.text),
    untrusted("their_own_notes", i.bullet.facts.join("\n")),
    untrusted("answer", i.answer),
  ],
  cache: null,
  manualStep: "self_review",
});

/**
 * interview_research, structuring step: web research notes into questions to practise.
 * Sources are cited by number from the list the search returned, so no URL is invented.
 */
export const interviewResearch = defineTask({
  name: "interview_research",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({
    employer: z.string().max(160),
    role: z.string().max(160),
    sources: z.array(z.object({ url: z.string(), title: z.string() })).max(30),
    notes: z.string().max(12_000),
  }),
  output: z.object({
    questions: z
      .array(z.object({ question: z.string().min(8).max(240), why: z.string().max(200), about_employer: z.boolean(), source_index: z.number().int().min(1) }))
      .max(6),
  }),
  maxTokens: 2500,
  timeoutMs: 25_000,
  effort: "low",
  render: (i) => [
    trusted(`Interview for ${i.role} at ${i.employer}.`),
    trusted(`Sources:\n${i.sources.map((s, n) => `${n + 1}. ${s.url} (${s.title.slice(0, 80)})`).join("\n") || "none"}`),
    untrusted("research_notes", i.notes),
  ],
  cache: null,
  manualStep: "none",
});

/**
 * mock_interview (founder round 26, D-189): one turn of a mock interview. The interviewer
 * reads the last answer, gives short feedback on it, and asks the next question, often a
 * follow up on what the person just said, the way real panels probe. Questions never put
 * a fact in the person's mouth; feedback checks the answer against the CV they sent.
 */
export const mockInterview = defineTask({
  name: "mock_interview",
  model: "claude-sonnet-5-5",
  promptVersion: "v2",
  input: z.object({
    job: z.object({ title: z.string().max(200), employer: z.string().max(200), level: z.string().max(60).nullable(), requirements: z.array(z.string().max(300)).max(12), format: z.string().max(30) }),
    cv_lines: z.array(z.object({ id: z.string(), role: z.string().max(200), text: z.string().max(400) })).max(30),
    turns: z
      .array(z.object({ question: z.string().max(400), kind: z.string().max(20), bullet_id: z.string().nullable(), answer: z.string().max(3000) }))
      .min(1)
      .max(12),
    /** Questions asked so far, the one just answered included, and how many the interview has. */
    asked: z.number().int().min(1),
    total: z.number().int().min(2),
    /** The last answer closes the interview: no next question, a wrap up instead. */
    final: z.boolean(),
  }),
  output: z.object({
    feedback: z.object({
      /** How the answer would land with a panel (D-204): shown in the analysis at the end. */
      rating: z.enum(["strong", "good", "work_on"]),
      matches_cv: z.enum(["yes", "partly", "no"]),
      did_well: z.string().max(220).nullable(),
      improve: z.array(z.string().max(220)).max(3),
      new_claims: z.array(z.string().max(220)).max(3),
    }),
    next: z
      .object({
        question: z.string().min(8).max(300),
        why: z.string().max(220),
        kind: z.enum(["follow_up", "defend_cv", "job_fit", "situational", "technical", "standard"]),
        bullet_id: z.string().nullable(),
      })
      .nullable(),
    wrap_up: z.object({ strengths: z.array(z.string().max(220)).max(3), work_on: z.array(z.string().max(220)).max(3), encouragement: z.string().max(320) }).nullable(),
  }),
  maxTokens: 3500,
  timeoutMs: 40_000,
  effort: "medium",
  render: (i) => [
    trusted(`Mock interview for ${i.job.title} at ${i.job.employer}. Level: ${i.job.level ?? "not stated"}. Format: ${i.job.format}. Question ${i.asked} of ${i.total} has just been answered.${i.final ? " That was the last question: give feedback and the wrap up, and no next question." : ""}`),
    untrusted("cv_sent", i.cv_lines.map((l) => `[${l.id}] (${l.role}) ${l.text}`).join("\n") || "No CV lines."),
    untrusted("what_the_job_asks_for", i.job.requirements.map((r) => `- ${r}`).join("\n") || "- not listed"),
    untrusted("interview_so_far", i.turns.map((t, n) => `Q${n + 1} [${t.kind}${t.bullet_id ? `, line ${t.bullet_id}` : ""}]: ${t.question}\nA${n + 1}: ${t.answer}`).join("\n\n")),
  ],
  cache: null,
  manualStep: "practise_from_cv",
});
