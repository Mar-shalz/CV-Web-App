import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * polish_achievement (D-125): turns one spoken achievement into a clear line before it
 * lands in the text box. The person reads and edits it before saving, and code checks
 * that no number was added (lib/vault/polish.ts). Haiku class: short and fast.
 */
export const polishAchievement = defineTask({
  name: "polish_achievement",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({
    role: z.string().max(240).nullable(),
    spoken: z.string().trim().min(3).max(2000),
  }),
  output: z.object({
    text: z.string().min(3).max(500),
    unclear: z.boolean(),
  }),
  maxTokens: 800,
  timeoutMs: 12_000,
  effort: "low",
  render: (i) => [trusted(i.role ? `The role: ${i.role}.` : "The role isn't named."), untrusted("spoken_answer", i.spoken)],
  cache: null,
  manualStep: "none",
});
