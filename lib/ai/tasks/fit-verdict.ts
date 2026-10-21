import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/** fit_verdict (Build pack section 6): verdict, requirement list (met, partly, missing) with vault item ids, gaps, one line reason. */
export const fitVerdict = defineTask({
  name: "fit_verdict",
  model: "claude-sonnet-5-5",
  promptVersion: "v1",
  input: z.object({
    job: z.object({
      title: z.string(),
      employer: z.string(),
      requirements: z.array(z.object({ text: z.string(), importance: z.enum(["must", "nice"]) })).max(20),
    }),
    eligibility: z.array(z.object({ rule: z.string(), result: z.string(), reason: z.string() })).max(16),
    items: z.array(z.object({ id: z.string(), text: z.string(), role: z.string() })).max(80),
    education: z.array(z.string()).max(10),
    cacheKey: z.string(),
  }),
  output: z.object({
    verdict: z.enum(["apply", "apply_with_care", "skip"]),
    top_match: z.string().max(120).nullable(),
    main_gap: z.string().max(120).nullable(),
    requirements: z
      .array(z.object({ text: z.string().max(240), status: z.enum(["met", "partly", "missing"]), vault_item_ids: z.array(z.string()).max(4), note: z.string().max(200).nullable() }))
      .max(20),
    gaps: z.array(z.object({ gap: z.string().max(160), address_in: z.enum(["cv", "email", "interview"]), how: z.string().max(240) })).max(3),
  }),
  // Quality first (founder, round 28): the advice on whether to apply gets the most thinking.
  maxTokens: 10_000,
  timeoutMs: 90_000,
  effort: "high",
  render: (i) => [
    trusted(`Hard requirement checks, already decided by code (do not change them):\n${i.eligibility.map((e) => `- ${e.rule}: ${e.result}. ${e.reason}`).join("\n") || "- none stated"}`),
    trusted(`The person's confirmed evidence (cite by id):\n${i.items.map((it) => `- [${it.id}] (${it.role}) ${it.text}`).join("\n") || "- none yet"}`),
    trusted(`Education: ${i.education.join("; ") || "none added"}`),
    untrusted("job_requirements", `${i.job.title} at ${i.job.employer}\n${i.job.requirements.map((r) => `- (${r.importance}) ${r.text}`).join("\n")}`),
  ],
  cache: { key: (i) => i.cacheKey, ttlSeconds: 7 * 24 * 3600 },
  manualStep: "read_requirements_yourself",
});
