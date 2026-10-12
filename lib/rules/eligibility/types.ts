import type { HardFilter, FilterType } from "@/lib/jobs/schema";

export type RuleResult = "pass" | "fail" | "unknown" | "care" | "not_applicable";

/** What the missing details sheet can ask for, one at a time. */
export type MissingDetail =
  | "date_of_birth"
  | "gender"
  | "nysc_status"
  | "degree_class"
  | "cgpa_scale"
  | "location"
  | "olevel"
  | "licence"
  | "right_to_work"
  | "education";

export type RuleOutcome = {
  type: FilterType | "deadline";
  result: RuleResult;
  /** The post's own words. Always shown on the check screen. */
  quote: string;
  /** Plain words: what the post needs, and what we know about the user. Never advice to hide anything. */
  reason: string;
  needs?: MissingDetail;
};

export type Education = {
  title: string; // "BSc Accounting", "HND Banking and Finance"
  grade: string | null; // "Second Class Upper", "3.62/5.00", "Upper Credit"
  graduationYear: number | null;
};

export type EligibilityProfile = {
  today: string; // YYYY-MM-DD, Lagos
  dateOfBirth: string | null;
  gender: string | null;
  nysc: { status: "serving" | "completed" | "exempted" | null; end: string | null };
  education: Education[];
  /** Months of work by kind, from confirmed vault roles. */
  months: { jobs: number; jobsAfterNysc: number; internships: number };
  licences: { name: string; status: "qualified" | "in_progress" | "part_qualified" | "unknown" }[];
  location: { city: string | null; state: string | null } | null;
  olevel: { sittings: { subjects: { name: string; grade: string }[] }[] } | null;
  rightToWork: Record<string, "yes" | "needs_sponsorship">;
};

export type EligibilityInput = { filters: HardFilter[]; deadline: string | null; profile: EligibilityProfile };

export type EligibilityResult = { ruleSetVersion: string; overall: "pass" | "fail" | "unknown"; outcomes: RuleOutcome[] };
