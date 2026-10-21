import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * cv_summary (D-177): the professional summary on its own, written to an executive CV
 * writer's standard for this job. A focused step gets better results than asking the CV
 * writer for everything at once. The fact lock checks it like any other line, and the
 * person confirms it before it goes on the CV (D-163).
 */
export const cvSummary = defineTask({
  name: "cv_summary",
  model: "claude-sonnet-5-5",
  promptVersion: "v2",
  input: z.object({
    job: z.object({ title: z.string().max(160), employer: z.string().max(160), requirements: z.array(z.string().max(300)).max(12) }),
    title_line: z.string().max(160).nullable(),
    level: z.string().max(60),
    experience_months: z.number().int().min(0),
    education: z.array(z.string().max(300)).max(8),
    certifications: z.array(z.string().max(300)).max(10),
    items: z.array(z.object({ id: z.string(), role: z.string().max(200), text: z.string().max(400), source_quote: z.string().max(600).nullable() })).max(40),
    skills: z.array(z.string().max(60)).max(60),
    own_summary: z.string().max(1500).nullable(),
    /** Skills the person has that the job names (D-185). */
    job_terms: z.array(z.string().max(60)).max(30).default([]),
    spelling: z.string().max(40),
  }),
  output: z.object({
    text: z.string().min(60).max(900),
    source_item_ids: z.array(z.string()).max(8),
  }),
  maxTokens: 3000,
  timeoutMs: 45_000,
  // Medium (round 27): high thinking timed out at 40 seconds on Gemini's free tier.
  effort: "medium",
  render: (i) => [
    trusted(`Job: ${i.job.title} at ${i.job.employer}. Spelling: ${i.spelling}. Person's level: ${i.level}, about ${Math.round(i.experience_months / 12)} years of full time work.${i.title_line ? `\nTheir CV title line: ${i.title_line}` : ""}`),
    trusted(`Education: ${i.education.join("; ") || "none"}\nCertifications: ${i.certifications.join("; ") || "none"}\nSkills: ${i.skills.join(", ") || "none listed"}`),
    trusted(`Evidence items (cite by id):\n${i.items.map((it) => `- [${it.id}] (${it.role}) ${it.text}${it.source_quote ? ` (their words: "${it.source_quote}")` : ""}`).join("\n")}`),
    ...(i.own_summary ? [untrusted("own_summary", i.own_summary)] : []),
    ...(i.job_terms.length ? [trusted(`Job terms this person has: ${i.job_terms.join(", ")}`)] : []),
    untrusted("what_the_job_asks_for", i.job.requirements.map((r) => `- ${r}`).join("\n") || "- not listed"),
  ],
  cache: null,
  manualStep: "none",
});
