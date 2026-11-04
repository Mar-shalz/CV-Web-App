import list from "@/config/lists/visa_sponsorship.json";

// What a job post says about visa sponsorship (founder round 42, D-213), read from its text
// before the post is checked. The same three answers the job reader gives
// (parsed.visa_sponsorship). Pure, so it is unit tested.

export type Visa = "offered" | "not_offered" | "not_mentioned";

const NOT = list.not_offered.map((p) => new RegExp(p));
const YES = list.offered.map((p) => new RegExp(p));

export function visaFromText(text: string | null | undefined): Visa {
  const t = (text ?? "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
  if (NOT.some((r) => r.test(t))) return "not_offered";
  return YES.some((r) => r.test(t)) ? "offered" : "not_mentioned";
}
