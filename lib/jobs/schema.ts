import { z } from "zod";

// The Job schema (Build pack section 6) as the parser returns it and the review screen edits it.

export const FILTER_TYPES = [
  "max_age",
  "min_degree_class",
  "cgpa",
  "degree_type",
  "discipline",
  "nysc",
  "years_experience",
  "licence",
  "location",
  "olevel",
  "graduation_window",
  "gender",
  "right_to_work",
] as const;
export type FilterType = (typeof FILTER_TYPES)[number];

/**
 * One hard filter in a flat shape the model can fill reliably. What each field means
 * depends on `type` (see prompts/parse_job). `quote` is the post's exact words: the
 * check screen shows it, and the eligibility engine reads only the structured fields.
 */
export const hardFilterSchema = z.object({
  type: z.enum(FILTER_TYPES),
  quote: z.string().max(400),
  number: z.number().nullable(),
  number2: z.number().nullable(),
  values: z.array(z.string().max(80)).max(12),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  flag: z.boolean().nullable(),
});
export type HardFilter = z.infer<typeof hardFilterSchema>;

const t = (max: number) => z.string().max(max).nullable();

export const jobSchema = z.object({
  is_job_post: z.boolean(),
  title: t(160),
  employer_name: t(160),
  employer_domain_claimed: t(120),
  employer_is_agency_client: z.boolean(),
  location: z.object({ city: t(80), state: t(80), country: t(60), country_code: z.string().regex(/^[A-Z]{2}$/).nullable(), remote: z.boolean() }),
  salary: z.object({ min: z.number().nullable(), max: z.number().nullable(), currency: z.string().max(8).nullable(), period: z.enum(["year", "month", "week", "day", "hour"]).nullable() }),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  how_to_apply: z.object({
    channel: z.enum(["email", "form", "portal", "whatsapp", "in_person", "unknown"]),
    email: t(160),
    subject_format: t(200),
    url: t(400),
    required_documents: z.array(z.string().max(120)).max(10),
  }),
  hard_filters: z.array(hardFilterSchema).max(14),
  requirements: z.array(z.object({ text: z.string().max(240), importance: z.enum(["must", "nice"]) })).max(20),
  contacts: z.object({ emails: z.array(z.string().max(160)).max(6), phones: z.array(z.string().max(40)).max(6) }),
  payment_mentioned: z.object({ mentioned: z.boolean(), quote: t(300) }),
  visa_sponsorship: z.enum(["offered", "not_offered", "not_mentioned"]),
  experience_level: z.enum(["entry", "graduate_programme", "mid", "senior", "unknown"]),
});
export type ParsedJob = z.infer<typeof jobSchema>;

export const EMPTY_JOB: ParsedJob = {
  is_job_post: true,
  title: null,
  employer_name: null,
  employer_domain_claimed: null,
  employer_is_agency_client: false,
  location: { city: null, state: null, country: null, country_code: null, remote: false },
  salary: { min: null, max: null, currency: null, period: null },
  deadline: null,
  how_to_apply: { channel: "unknown", email: null, subject_format: null, url: null, required_documents: [] },
  hard_filters: [],
  requirements: [],
  contacts: { emails: [], phones: [] },
  payment_mentioned: { mentioned: false, quote: null },
  visa_sponsorship: "not_mentioned",
  experience_level: "unknown",
};
