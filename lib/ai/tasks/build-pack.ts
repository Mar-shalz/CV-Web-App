import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * build_pack (Build pack section 6): what the employer asked for, read from the post:
 * attachment names, the checklist, form fields and portal steps. Since D-188 the email
 * and the cover letter have their own writer (write_email), so this is extraction only,
 * back on the light model.
 */
export const buildPack = defineTask({
  name: "build_pack",
  model: "claude-haiku-5-5",
  promptVersion: "v5",
  input: z.object({
    person: z.object({ full_name: z.string(), course: z.string().nullable() }),
    job: z.object({ title: z.string(), employer: z.string(), channel: z.string(), email: z.string().nullable(), url: z.string().nullable(), required_documents: z.array(z.string()).max(10) }),
    cv_file: z.string(),
  }),
  output: z.object({
    attachment_names: z.array(z.string().max(120)).max(8),
    checklist: z.array(z.object({ item: z.string().max(120), required: z.boolean() })).max(10),
    form_fields: z.array(z.object({ label: z.string().max(80), hint: z.string().max(160) })).max(20),
    portal_steps: z.array(z.string().max(200)).max(8),
  }),
  maxTokens: 2000,
  timeoutMs: 25_000,
  effort: "low",
  render: (i) => [
    trusted(`Applicant: ${i.person.full_name}${i.person.course ? `, ${i.person.course}` : ""}.\nCV file name: ${i.cv_file}`),
    untrusted("how_to_apply", `Job: ${i.job.title} at ${i.job.employer}\nChannel: ${i.job.channel}\nEmail: ${i.job.email ?? "none"}\nLink: ${i.job.url ?? "none"}\nDocuments asked for: ${i.job.required_documents.join(", ") || "none listed"}`),
  ],
  cache: null,
  manualStep: "write_email_yourself",
});

/**
 * write_email (D-188): the application email, and the cover letter's paragraphs when the
 * job asks for one. A focused writer on the judgement model, the way the summary has its
 * own (D-177): this is the first thing an employer reads. Only the CV lines the person
 * accepted are used; code checks every number, date, "in charge" verb and added claim.
 */
export const writeEmail = defineTask({
  name: "write_email",
  model: "claude-sonnet-5-5",
  promptVersion: "v1",
  input: z.object({
    person: z.object({ full_name: z.string(), course: z.string().nullable(), title_line: z.string().nullable().default(null) }),
    /** What the job asks for most (D-170), so the proof answers it. */
    requirements: z.array(z.string()).max(6).default([]),
    spelling: z.string().default("British English"),
    job: z.object({ title: z.string(), employer: z.string(), level: z.string().max(60).nullable().default(null), summary: z.string().max(1200).nullable().default(null) }),
    proof: z.array(z.string()).max(8),
    gap_note: z.string().nullable(),
    letter: z.boolean().default(false),
    previous_problems: z.array(z.string().max(300)).max(12).default([]),
  }),
  output: z.object({
    body: z.string().max(1800),
    cover_letter: z.array(z.string().max(1400)).max(6).default([]),
  }),
  maxTokens: 6000,
  timeoutMs: 45_000,
  // Medium, not high: on live tests high took about 16 seconds for no better email (round 26).
  effort: "medium",
  render: (i) => [
    trusted(`Applicant: ${i.person.full_name}${i.person.course ? `, ${i.person.course}` : ""}.${i.person.title_line ? `\nTheir CV title line: ${i.person.title_line}` : ""}\nSpelling: ${i.spelling}.`),
    trusted(`Their strongest proof for this job (use only these facts):\n${i.proof.map((p) => `- ${p}`).join("\n")}`),
    ...(i.gap_note ? [trusted(`One gap to address honestly in a sentence: ${i.gap_note}`)] : []),
    trusted(
      i.letter
        ? "Cover letter: yes. Write the cover letter paragraphs (260 to 360 words), and keep the email a short covering note of 70 to 120 words."
        : "Cover letter: no. Return an empty cover_letter list. The email is 170 to 230 words: a greeting and four short paragraphs, using the proof's numbers and settings.",
    ),
    untrusted(
      "the_job",
      `Job: ${i.job.title} at ${i.job.employer}${i.job.level ? ` (${i.job.level})` : ""}\nWhat they ask for most:\n${i.requirements.map((r) => `- ${r}`).join("\n") || "- not listed"}${i.job.summary ? `\nAbout the role: ${i.job.summary}` : ""}`,
    ),
    ...(i.previous_problems.length ? [trusted(`Your previous draft had these problems. Fix every one:\n${i.previous_problems.map((p) => `- ${p}`).join("\n")}`)] : []),
  ],
  cache: null,
  manualStep: "write_email_yourself",
});
