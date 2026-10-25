import ngPrivate from "@/config/country_profiles/ng_private.json";
import ngGraduate from "@/config/country_profiles/ng_graduate.json";
import uk from "@/config/country_profiles/uk.json";
import us from "@/config/country_profiles/us.json";
import ca from "@/config/country_profiles/ca.json";
import gulf from "@/config/country_profiles/gulf.json";
import type { ProfileId } from "@/lib/rules/destination";

export const PROFILES = { ng_private: ngPrivate, ng_graduate: ngGraduate, uk, us, ca, gulf } as const;
export type Profile = (typeof PROFILES)[ProfileId];

export const SECTION_HEADINGS: Record<string, string> = {
  profile: "Profile",
  experience: "Work experience",
  education: "Education",
  nysc: "NYSC",
  leadership: "Leadership and activities",
  skills: "Skills",
  certifications: "Certifications and licences",
  referees: "Referees",
};

/**
 * What each country's recruiters expect beyond the config (D-198, from Jobberman, Prospects,
 * Harvard's and Job Bank Canada's guidance, and Gulf recruiter guides).
 */
const COUNTRY_RULES: Record<string, string[]> = {
  ng_private: ["Write it as a Nigerian CV: a short career summary aimed at this job, then the strongest proof. Nigerian recruiters read for NYSC status, class of degree and named referees, which code places."],
  ng_graduate: ["Write it as a Nigerian graduate programme CV: an education led CV, with SIWES, NYSC, projects and leadership written as real experience."],
  uk: ["Write it as a UK CV: British spelling, a three or four line Profile at the top focused on this sector, achievements over duties."],
  us: ["Write it as a US resume: American spelling, a short Summary, Experience before Education once the person has real work experience, no photo, no date of birth, no references section."],
  ca: ["Write it as a Canadian resume: Canadian spelling (colour, centre, organize, program), a short Summary, Experience before Education once the person has real work experience, no photo, no age or date of birth, no references section. Volunteer work counts as experience."],
  gulf: ["Write it as a Gulf CV: British spelling, a short Profile, Experience before Education once the person has real work experience. List every language they have at their real level; employers in the Gulf value Arabic, French and English."],
};

/** Plain rules for the tailor prompt, read from the profile config (profiles can hide or show fields, never change a fact). */
export function profileRules(p: Profile, underTwoYears: boolean): string[] {
  const order = underTwoYears ? p.section_order_under_2_years : p.section_order;
  return [
    `Section order: ${order.map((s) => SECTION_HEADINGS[s]).join(", ")}.`,
    `Single column, standard headings, real text, no tables, icons, graphics or photo${p.personal_fields.photo === "never" ? "" : " unless the job asks"}.`,
    `Length: at most ${p.max_pages.default} pages.`,
    `Reverse chronological within each section. Never a functional CV.`,
    "nysc_explainer" in p ? `Explain NYSC once as ${p.nysc_explainer} and HND as ${("hnd_explainer" in p && p.hnd_explainer) || "a degree level qualification"}.` : "Write NYSC and SIWES the way local recruiters expect.",
    ...(COUNTRY_RULES[p.id] ?? []),
    p.class_of_degree === "shown" ? "Class of degree goes in the Education section; the summary may mention it when it helps. Never in the headline." : "Class of degree appears in the Education section as written, never in the headline.",
  ];
}

/** "Tolu_Adebayo_CV_Graduate_Trainee", or "..._Resume_..." for US and Canadian resumes. */
export function fileBase(fullName: string | null, role: string, label = "CV"): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  const [first = "My", ...rest] = clean(fullName ?? "My CV");
  const last = rest.at(-1) ?? "";
  return [first, last, label === "Resume" ? "Resume" : "CV", ...clean(role).slice(0, 4)].filter(Boolean).join("_");
}
