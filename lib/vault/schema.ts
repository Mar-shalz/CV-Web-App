import { z } from "zod";

// Shapes shared by the CV parser, the story interview and the vault screens.

import { ROLE_KINDS, EMPLOYMENT_TYPES, OWNERSHIP } from "./labels";
export * from "./labels";

/** Year and month only: CVs rarely give days, and the fact lock compares months. */
export const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM")
  .nullable();

export const metricSchema = z.object({
  value: z.number(),
  unit: z.string().max(40),
  approximate: z.boolean(),
});
export type Metric = z.infer<typeof metricSchema>;


export const draftItemSchema = z.object({
  text: z.string().min(3).max(400),
  source_quote: z.string().max(600),
  metrics: z.array(metricSchema).max(6),
  ownership: z.enum(OWNERSHIP),
  skills: z.array(z.string().max(60)).max(10),
});
export type DraftItem = z.infer<typeof draftItemSchema>;

export const draftRoleSchema = z.object({
  kind: z.enum(ROLE_KINDS),
  organisation: z.string().max(160).nullable(),
  title: z.string().max(160).nullable(),
  location: z.string().max(120).nullable(),
  start: yearMonth,
  end: yearMonth,
  is_current: z.boolean(),
  grade: z.string().max(80).nullable(),
  employment_type: z.enum(EMPLOYMENT_TYPES).nullable().optional(),
  items: z.array(draftItemSchema).max(12),
});
export type DraftRole = z.infer<typeof draftRoleSchema>;
