import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * Stub task that proves the pipeline end to end (prompt file, delimiters, structured
 * output, validation, logging). Not used by any screen. The Build pack tasks
 * (parse_cv, parse_job, tailor_cv and the rest) are added in their slices.
 */
export const smokeTest = defineTask({
  name: "smoke_test",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({ text: z.string().trim().min(1).max(4000) }),
  output: z.object({
    is_english: z.boolean(),
    word_count: z.number().int().min(0),
  }),
  maxTokens: 2048,
  timeoutMs: 15_000,
  effort: "low",
  render: (input) => [trusted("Report on this text."), untrusted("pasted_text", input.text)],
  cache: null,
  manualStep: "none",
});
