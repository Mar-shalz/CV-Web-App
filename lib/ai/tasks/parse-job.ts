import { z } from "zod";
import { defineTask, trusted, untrusted, untrustedFile } from "../types";
import { jobSchema } from "@/lib/jobs/schema";

/** parse_job (Build pack section 6): the Job schema from post text, a PDF or a flyer image, including hard filters and how to apply. */
export const parseJob = defineTask({
  name: "parse_job",
  model: "claude-haiku-5-5",
  promptVersion: "v2",
  input: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string().min(20).max(40_000), postHash: z.string(), today: z.string() }),
    z.object({ kind: z.literal("pdf"), base64: z.string(), postHash: z.string(), today: z.string() }),
    z.object({ kind: z.literal("image"), base64: z.string(), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), postHash: z.string(), today: z.string() }),
  ]),
  output: jobSchema,
  maxTokens: 8000,
  timeoutMs: 40_000,
  effort: "medium",
  render: (i) => [
    trusted(`Today's date in Lagos is ${i.today}. Read this job post and return the Job schema.`),
    i.kind === "text" ? untrusted("job_post", i.text) : i.kind === "pdf" ? untrustedFile("job_post_file", "application/pdf", i.base64) : untrustedFile("job_flyer", i.mediaType, i.base64),
  ],
  cache: { key: (i) => i.postHash, ttlSeconds: 7 * 24 * 3600 },
  manualStep: "type_job_details",
});
