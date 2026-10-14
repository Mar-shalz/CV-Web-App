import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * cv_target (D-137): for a general CV, decides the standard job title, industry, level
 * and the field's own keywords, so the writer uses the words recruiters and applicant
 * tracking systems look for. Keywords are search terms, not facts: the CV writer and the
 * fact lock still use only what the person's evidence supports.
 */
export const cvTarget = defineTask({
  name: "cv_target",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({
    roles: z.array(z.string().max(300)).max(30),
    achievements: z.array(z.string().max(400)).max(60),
    education: z.array(z.string().max(300)).max(8),
    certifications: z.array(z.string().max(300)).max(10),
    experience_months: z.number().int().min(0),
  }),
  output: z.object({
    target_title: z.string().min(2).max(80),
    industry: z.string().min(2).max(60),
    level: z.enum(["entry", "graduate", "early career", "mid", "senior"]),
    keywords: z.array(z.string().min(2).max(50)).min(6).max(18),
    angle: z.string().max(200),
  }),
  maxTokens: 1500,
  timeoutMs: 20_000,
  effort: "low",
  render: (i) => [
    trusted(`Months of full time work: ${i.experience_months}.`),
    untrusted(
      "confirmed_experience",
      [`Roles:\n${i.roles.map((r) => `- ${r}`).join("\n") || "none"}`, `Achievements:\n${i.achievements.map((a) => `- ${a}`).join("\n") || "none"}`, `Education:\n${i.education.map((e) => `- ${e}`).join("\n") || "none"}`, `Certifications:\n${i.certifications.map((c) => `- ${c}`).join("\n") || "none"}`].join("\n\n"),
    ),
  ],
  cache: null,
  manualStep: "none",
});
