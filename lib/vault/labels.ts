// Role kinds, labels and ownership words (no zod), so screens in the browser can use them
// without shipping the validation library (D-150). lib/vault/schema.ts re-exports them.

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

export const OWNERSHIP = ["did", "helped", "led"] as const;
export type Ownership = (typeof OWNERSHIP)[number];
