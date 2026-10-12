import { z } from "zod";
import { defineTask, trusted, untrusted } from "../types";
import { draftItemSchema } from "@/lib/vault/schema";

const roleRef = z.object({ kind: z.string(), title: z.string().nullable(), organisation: z.string().nullable() });

/** interview_next_question (Build pack section 6): one question, its target role and its intent. */
export const interviewNextQuestion = defineTask({
  name: "interview_next_question",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({
    role: roleRef,
    known_items: z.array(z.string().max(400)).max(30),
    turns: z.array(z.object({ question: z.string().max(400), answer: z.string().max(6000) })).max(12),
  }),
  output: z.object({
    question: z.string().min(8).max(220),
    intent: z.enum(["routine", "number", "scale", "result", "ownership", "wrap_up"]),
    done: z.boolean(),
  }),
  maxTokens: 2048,
  timeoutMs: 20_000,
  effort: "low",
  render: (i) => [
    trusted(`Role: ${i.role.title ?? "untitled"} at ${i.role.organisation ?? "an organisation"} (${i.role.kind}).`),
    trusted(`Achievements already in the vault for this role: ${i.known_items.length ? "\n- " + i.known_items.join("\n- ") : "none"}`),
    ...i.turns.flatMap((t, n) => [trusted(`Question ${n + 1}: ${t.question}`), untrusted(`answer_${n + 1}`, t.answer)]),
    trusted("Write the next question."),
  ],
  cache: null,
  manualStep: "type_achievements",
});

/** extract_items (Build pack section 6): draft evidence items from one answer, each with its exact source quote. */
export const extractItems = defineTask({
  name: "extract_items",
  model: "claude-haiku-5-5",
  promptVersion: "v1",
  input: z.object({ role: roleRef, question: z.string().max(400), answer: z.string().min(1).max(6000) }),
  output: z.object({
    items: z.array(draftItemSchema).max(6),
    follow_up: z.string().max(220).nullable(),
    not_english: z.boolean(),
  }),
  maxTokens: 4096,
  timeoutMs: 25_000,
  effort: "low",
  render: (i) => [
    trusted(`Role: ${i.role.title ?? "untitled"} at ${i.role.organisation ?? "an organisation"} (${i.role.kind}).`),
    trusted(`Question asked: ${i.question}`),
    untrusted("answer", i.answer),
  ],
  cache: null,
  manualStep: "type_achievements",
});
