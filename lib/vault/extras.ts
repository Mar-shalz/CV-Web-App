import "server-only";
import { cache } from "react";
import type { Viewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

// The parts of a CV that aren't roles (D-162): the person's own profile summary, their
// skills list, their referees, and skills they added while checking a job. Kept on the
// profiles row, owner only. Each is the person's own words; nothing here is generated.

export type Referee = { name: string; role: string | null; organisation: string | null; phone: string | null; email: string | null; relationship: string | null };
/** A skill the person said they have when a job check found it missing. Shown apart on My Experience, used in the Skills section. */
export type AddedSkill = { id: string; skill: string; note: string | null; requirement: string; jobId: string; jobTitle: string | null; at: string };
export type CvExtras = { summary: string | null; skills: string[]; referees: Referee[]; addedSkills: AddedSkill[]; ready: boolean };

export const EMPTY_EXTRAS: CvExtras = { summary: null, skills: [], referees: [], addedSkills: [], ready: false };

const DEMO_EXTRAS: CvExtras = {
  summary: "Accounting graduate with banking experience from SIWES and a year of NYSC finance support. Comfortable with reconciliations, Excel and customer service.",
  skills: ["Excel", "Sage 50", "Reconciliation", "Customer onboarding"],
  referees: [{ name: "Mrs Funke Bello", role: "Branch Operations Manager", organisation: "Northline Bank, Yaba", phone: null, email: null, relationship: "SIWES supervisor" }],
  addedSkills: [],
  ready: true,
};

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Once per request, like the vault. `ready` is false until the round 20 database update has run. */
export const getExtras = cache(async (viewer: Viewer): Promise<CvExtras> => {
  if (viewer.preview) return DEMO_EXTRAS;
  const supabase = await createClient();
  // "*" so this never breaks before the columns exist.
  const { data } = await supabase.from("profiles").select("*").eq("user_id", viewer.id).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  if (!("skills" in row)) return EMPTY_EXTRAS;
  return {
    summary: typeof row.summary === "string" && row.summary.trim() ? row.summary : null,
    skills: asArray<string>(row.skills).filter((s) => typeof s === "string" && s.trim()),
    referees: asArray<Referee>(row.referees).filter((r) => r && typeof r.name === "string"),
    addedSkills: asArray<AddedSkill>(row.added_skills).filter((a) => a && typeof a.skill === "string"),
    ready: true,
  };
});

/** Skills for a CV: the listed ones, then those added during job checks, without repeats. */
export function allSkills(x: CvExtras): string[] {
  const seen = new Set<string>();
  return [...x.skills, ...x.addedSkills.map((a) => a.skill)].filter((s) => {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Cleans a typed skills list: split on commas and new lines, trimmed, no repeats, at most 60. */
export function cleanSkills(raw: string | string[]): string[] {
  const parts = (Array.isArray(raw) ? raw : raw.split(/[,\n;]/)).map((s) => s.replace(/\s+/g, " ").trim().slice(0, 60)).filter(Boolean);
  return [...new Map(parts.map((s) => [s.toLowerCase(), s])).values()].slice(0, 60);
}
