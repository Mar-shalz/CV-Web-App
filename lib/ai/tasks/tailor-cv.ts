import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

const bullet = z.object({
  text: z.string().min(5).max(360),
  source_item_ids: z.array(z.string()).min(1).max(4),
  rewrite_type: z.enum(["kept", "reworded", "reordered", "merged"]),
});

/** tailor_cv (Build pack section 6): sections and bullets, each bullet with source item ids and a rewrite type. */
export const tailorCv = defineTask({
  name: "tailor_cv",
  model: "claude-sonnet-5-5",
  promptVersion: "v3",
  input: z.object({
    profile: z.object({ label: z.string(), spelling: z.string(), rules: z.array(z.string()).max(20) }),
    job: z.object({ title: z.string(), employer: z.string(), requirements: z.array(z.string()).max(20) }),
    experience_months: z.number(),
    roles: z
      .array(
        z.object({
          role_id: z.string(),
          kind: z.string(),
          heading: z.string(),
          items: z.array(z.object({ id: z.string(), text: z.string(), source_quote: z.string().nullable(), ownership: z.string(), rough_numbers: z.array(z.number()) })).max(20),
        }),
      )
      .max(30),
    education: z.array(z.string()).max(8),
    certifications: z.array(z.string()).max(10),
    vault_skills: z.array(z.string()).max(90),
    /** The person's own profile summary (D-162), the starting point for this job's summary. */
    own_summary: z.string().max(1500).nullable().default(null),
    previous_violations: z.array(z.string()).max(30),
    cacheKey: z.string(),
  }),
  output: z.object({
    title_line: z.string().max(120),
    summary: z.object({ text: z.string().max(900), source_item_ids: z.array(z.string()).max(8) }),
    experience: z
      .array(
        z.object({
          role_id: z.string(),
          bullets: z.array(bullet).max(8),
        }),
      )
      .max(20),
    skills: z.object({
      tools: z.array(z.string().max(60)).max(14),
      professional: z.array(z.string().max(60)).max(14),
      languages: z.array(z.string().max(30)).max(5),
    }),
    key_terms_used: z.array(z.string().max(40)).max(8),
  }),
  maxTokens: 14_000,
  timeoutMs: 60_000,
  effort: "medium",
  render: (i) => [
    trusted(`Format: ${i.profile.label} (${i.profile.spelling}).\nFormat rules:\n${i.profile.rules.map((r) => `- ${r}`).join("\n")}`),
    trusted(`Months of full time work: ${i.experience_months}.`),
    trusted(
      `The person's confirmed roles and evidence items (cite items by id):\n${i.roles
        .map(
          (r) =>
            `ROLE ${r.role_id} [${r.kind}] ${r.heading}\n${r.items
              .map((it) => `  - [${it.id}] ${it.text}${it.source_quote ? ` (their words: "${it.source_quote}")` : ""} ownership=${it.ownership}${it.rough_numbers.length ? ` rough_numbers=${it.rough_numbers.join(",")}` : ""}`)
              .join("\n") || "  (no items)"}`,
        )
        .join("\n")}`,
    ),
    trusted(`Education: ${i.education.join("; ") || "none"}\nCertifications: ${i.certifications.join("; ") || "none"}\nSkills in the vault: ${i.vault_skills.join(", ") || "none listed"}`),
    ...(i.own_summary ? [untrusted("own_summary", i.own_summary)] : []),
    untrusted("job_post", `${i.job.title} at ${i.job.employer}\nRequirements:\n${i.job.requirements.map((r) => `- ${r}`).join("\n")}`),
    ...(i.previous_violations.length
      ? [trusted(`Your previous draft broke the fact lock. Fix every one of these and change nothing else:\n${i.previous_violations.map((v) => `- ${v}`).join("\n")}`)]
      : []),
  ],
  cache: null,
  manualStep: "write_bullets_yourself",
});
