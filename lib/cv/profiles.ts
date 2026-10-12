import ngPrivate from "@/config/country_profiles/ng_private.json";
import ngGraduate from "@/config/country_profiles/ng_graduate.json";
import uk from "@/config/country_profiles/uk.json";
import type { ProfileId } from "@/lib/rules/destination";

export const PROFILES = { ng_private: ngPrivate, ng_graduate: ngGraduate, uk } as const;
export type Profile = (typeof PROFILES)[ProfileId];

export const SECTION_HEADINGS: Record<string, string> = {
  profile: "Profile",
  experience: "Experience",
  education: "Education",
  nysc: "NYSC",
  leadership: "Leadership and activities",
  skills: "Skills",
  certifications: "Certifications",
  referees: "Referees",
};

/** Plain rules for the tailor prompt, read from the profile config (profiles can hide or show fields, never change a fact). */
export function profileRules(p: Profile, underTwoYears: boolean): string[] {
  const order = underTwoYears ? p.section_order_under_2_years : p.section_order;
  return [
    `Section order: ${order.map((s) => SECTION_HEADINGS[s]).join(", ")}.`,
    `Single column, standard headings, real text, no tables, icons, graphics or photo${p.personal_fields.photo === "never" ? "" : " unless the job asks"}.`,
    `Length: at most ${p.max_pages.default} pages.`,
    `Reverse chronological within each section. Never a functional CV.`,
    p.id === "uk" ? `Explain NYSC once as ${("nysc_explainer" in p && p.nysc_explainer) || "national service"} and HND as ${("hnd_explainer" in p && p.hnd_explainer) || "a degree level qualification"}.` : "Write NYSC and SIWES as Nigerian recruiters expect.",
    p.class_of_degree === "prominent" ? "Make class of degree easy to see in the title line or summary." : "Class of degree appears in the Education section as written.",
  ];
}

export function fileBase(fullName: string | null, role: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  const [first = "My", ...rest] = clean(fullName ?? "My CV");
  const last = rest.at(-1) ?? "";
  return [first, last, "CV", ...clean(role).slice(0, 4)].filter(Boolean).join("_");
}
