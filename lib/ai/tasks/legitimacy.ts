import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * legitimacy_lookup, structuring step: research notes into findings. Sources are cited
 * by number from the list the search tool returned, so a URL can never be invented.
 * Haiku is enough for this extraction (D-027); the search itself runs on Sonnet.
 */
export const legitimacyLookup = defineTask({
  name: "legitimacy_lookup",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({
    employer: z.string().max(160),
    title: z.string().max(160),
    sources: z.array(z.object({ url: z.string(), title: z.string() })).max(30),
    notes: z.string().max(12_000),
  }),
  output: z.object({
    findings: z
      .array(
        z.object({
          id: z.enum(["L2-01", "L2-02", "L2-05", "L2-06", "L2-07", "L2-08"]),
          result: z.enum(["found", "not_found", "match", "mismatch", "warning", "unknown"]),
          text: z.string().max(240),
          source_index: z.number().int().min(1).nullable(),
        }),
      )
      .max(8),
  }),
  maxTokens: 3000,
  timeoutMs: 25_000,
  effort: "low",
  render: (i) => [
    trusted(`Job: ${i.title} at ${i.employer}.`),
    trusted(`Sources:\n${i.sources.map((s, n) => `${n + 1}. ${s.url} (${s.title.slice(0, 80)})`).join("\n") || "none"}`),
    untrusted("research_notes", i.notes),
  ],
  cache: null,
  manualStep: "none",
});
