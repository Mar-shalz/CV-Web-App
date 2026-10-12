import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/** build_pack (Build pack section 6): channel, recipient, subject, body, attachment names or form field list. */
export const buildPack = defineTask({
  name: "build_pack",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({
    person: z.object({ full_name: z.string(), course: z.string().nullable(), phone: z.string().nullable() }),
    job: z.object({ title: z.string(), employer: z.string(), channel: z.string(), email: z.string().nullable(), subject_format: z.string().nullable(), url: z.string().nullable(), required_documents: z.array(z.string()).max(10) }),
    proof: z.array(z.string()).max(5),
    gap_note: z.string().nullable(),
    cv_file: z.string(),
  }),
  output: z.object({
    subject: z.string().max(200),
    body: z.string().max(900),
    attachment_names: z.array(z.string().max(120)).max(8),
    checklist: z.array(z.object({ item: z.string().max(120), required: z.boolean() })).max(10),
    form_fields: z.array(z.object({ label: z.string().max(80), hint: z.string().max(160) })).max(20),
    portal_steps: z.array(z.string().max(200)).max(8),
  }),
  maxTokens: 3000,
  timeoutMs: 25_000,
  effort: "low",
  render: (i) => [
    trusted(`Applicant: ${i.person.full_name}${i.person.course ? `, ${i.person.course}` : ""}${i.person.phone ? `, ${i.person.phone}` : ""}.`),
    trusted(`CV file name: ${i.cv_file}`),
    trusted(`Their strongest proof for this job (use only these facts):\n${i.proof.map((p) => `- ${p}`).join("\n")}`),
    ...(i.gap_note ? [trusted(`One gap to address honestly in a sentence: ${i.gap_note}`)] : []),
    untrusted(
      "how_to_apply",
      `Job: ${i.job.title} at ${i.job.employer}\nChannel: ${i.job.channel}\nEmail: ${i.job.email ?? "none"}\nSubject format: ${i.job.subject_format ?? "none stated"}\nLink: ${i.job.url ?? "none"}\nDocuments asked for: ${i.job.required_documents.join(", ") || "none listed"}`,
    ),
  ],
  cache: null,
  manualStep: "write_email_yourself",
});
