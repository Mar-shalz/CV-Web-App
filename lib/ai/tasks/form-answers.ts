import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * form_answers (founder round 35, D-206): first drafts of the written questions on an
 * employer's application form ("Why do you want to work here?"), from the person's
 * accepted CV lines only. The extension fills them in marked for the person to read and
 * edit; nothing is submitted for them. Questions come from a web page: untrusted.
 */
export const formAnswers = defineTask({
  name: "form_answers",
  model: "claude-sonnet-5-5",
  promptVersion: "v1",
  input: z.object({
    job: z.object({ title: z.string().max(200), employer: z.string().max(200), requirements: z.array(z.string().max(300)).max(10) }),
    name: z.string().max(120),
    proof: z.array(z.object({ id: z.string().max(40), text: z.string().max(500) })).max(20),
    spelling: z.string().max(40),
    questions: z.array(z.object({ key: z.string().max(40), text: z.string().max(400) })).min(1).max(8),
  }),
  output: z.object({
    answers: z.array(z.object({ key: z.string().max(40), text: z.string().max(1600), proof_ids: z.array(z.string().max(40)).max(6) })).max(8),
  }),
  maxTokens: 4000,
  timeoutMs: 60_000,
  effort: "medium",
  render: (i) => [
    trusted(`Applicant: ${i.name}. Job: ${i.job.title} at ${i.job.employer}. Spelling: ${i.spelling}.`),
    trusted(`Their proof, from the CV they're sending (cite by id):\n${i.proof.map((p) => `- [${p.id}] ${p.text}`).join("\n")}`),
    untrusted("what_the_job_asks_for", i.job.requirements.map((r) => `- ${r}`).join("\n") || "- not listed"),
    untrusted("form_questions", i.questions.map((q) => `- [${q.key}] ${q.text}`).join("\n")),
  ],
  cache: null,
  manualStep: "none",
});
