import { z } from "zod";

// Shapes shared by the CV parser, the story interview and the vault screens.

export const ROLE_KINDS = ["job", "internship_siwes", "nysc_ppa", "volunteer", "project", "education", "certification", "licence"] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export const ROLE_KIND_LABELS: Record<RoleKind, string> = {
  job: "Work experience",
  internship_siwes: "Internship or SIWES",
  nysc_ppa: "NYSC",
  volunteer: "Volunteering or campus role",
  project: "Project",
  education: "Education",
  certification: "Professional certificate",
  licence: "Licence or membership",
};

/** Full time, part time or contract. Only part time and contract print on the CV (D-082). */
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = { full_time: "Full time", part_time: "Part time", contract: "Contract" };
/** How it reads next to the job title on a CV. Full time is the default, so it prints nothing. */
export const EMPLOYMENT_ON_CV: Record<EmploymentType, string | null> = { full_time: null, part_time: "Part-time", contract: "Contract" };
/** "Accounts Officer (Contract)". With no title, the label stands alone. */
export function withTerms(title: string, terms: string | null): string {
  if (!terms) return title;
  return title ? `${title} (${terms})` : terms;
}
/** Role kinds where employment type applies. */
export const EMPLOYMENT_KINDS: readonly RoleKind[] = ["job", "internship_siwes"];

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

export const OWNERSHIP = ["did", "helped", "led"] as const;
export type Ownership = (typeof OWNERSHIP)[number];

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
