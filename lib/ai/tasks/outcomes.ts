import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";

/**
 * classify_outcome (Build pack section 6): status, confidence, evidence text and the
 * interview date and time if present. The model only suggests: code checks the quote
 * is really in the message, and the person confirms before anything changes.
 */
export const classifyOutcome = defineTask({
  name: "classify_outcome",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({
    message: z.string().min(10).max(6000),
    application: z.object({ title: z.string(), employer: z.string(), sent_on: z.string().nullable() }),
  }),
  output: z.object({
    status: z.enum(["interview", "assessment", "rejected", "offer", "no_change", "unclear"]),
    confidence: z.number().min(0).max(1),
    evidence: z.string().max(400),
    about_this_application: z.enum(["yes", "no", "unsure"]),
    interview_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    interview_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    place_or_link: z.string().max(300).nullable(),
    format: z.enum(["in_person", "video", "phone", "test", "unknown"]),
    asks_for_payment: z.boolean(),
  }),
  maxTokens: 1500,
  timeoutMs: 20_000,
  effort: "low",
  render: (i) => [
    trusted(`The application: ${i.application.title} at ${i.application.employer}${i.application.sent_on ? `, sent on ${i.application.sent_on}` : ""}.`),
    trusted(`Today in Lagos: ${new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })}. Resolve relative dates ("next Thursday") from today.`),
    untrusted("message", i.message),
  ],
  cache: null,
  manualStep: "choose_status",
});

/** extract_debrief (Build pack section 6): questions asked, format, panel. */
export const extractDebrief = defineTask({
  name: "extract_debrief",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({ transcript: z.string().min(10).max(8000), role: z.string() }),
  output: z.object({
    questions: z.array(z.object({ text: z.string().max(300), topic: z.enum(["about_you", "cv", "technical", "situational", "motivation", "salary", "other"]) })).max(20),
    format: z.enum(["in_person", "video", "phone", "test", "assessment_centre", "unknown"]),
    panel: z.string().max(200).nullable(),
  }),
  maxTokens: 2500,
  timeoutMs: 20_000,
  effort: "low",
  render: (i) => [trusted(`Interview for: ${i.role}.`), untrusted("debrief", i.transcript)],
  cache: null,
  manualStep: "type_questions",
});
