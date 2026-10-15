"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { getExtras, cleanSkills, type AddedSkill, type Referee } from "@/lib/vault/extras";
import { lintCopy } from "@/lib/copy-lint";

// Profile summary, skills, referees and skills added during job checks (D-162).

export type ExtrasResult = { ok: true } | { ok: false; error: string };

const NOT_READY = "This needs the latest database update. Ask the team to run it, then try again.";

async function save(patch: Record<string, unknown>): Promise<ExtrasResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in again to save this." };
  if (viewer.preview) return { ok: true };
  const extras = await getExtras(viewer);
  if (!extras.ready) return { ok: false, error: NOT_READY };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", viewer.id);
  if (error) return { ok: false, error: "We couldn't save that. Try again." };
  revalidatePath("/experience");
  return { ok: true };
}

export async function saveSummary(text: string): Promise<ExtrasResult> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length > 1500) return { ok: false, error: "Keep it under 1,500 characters: two to four lines works best." };
  const banned = lintCopy(clean).filter((i) => i.kind === "phrase");
  if (banned.length) return { ok: false, error: `Try plainer words than "${banned[0]?.match}". Say what you do and what you're good at.` };
  return save({ summary: clean.replace(/\s*\u2014\s*/g, ", ") || null });
}

export async function saveSkills(raw: string): Promise<ExtrasResult> {
  return save({ skills: cleanSkills(raw) });
}

const referee = z.object({
  name: z.string().trim().min(2, "Add the referee's name.").max(120),
  role: z.string().trim().max(120).transform((v) => v || null),
  organisation: z.string().trim().max(160).transform((v) => v || null),
  phone: z.string().trim().max(40).transform((v) => v || null),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Check the email address.")
    .transform((v) => v || null),
  relationship: z.string().trim().max(160).transform((v) => v || null),
});

/** Referees are other people's details: only what the person types, at most four (D-162). */
export async function saveReferees(list: Referee[]): Promise<ExtrasResult> {
  const parsed = z.array(referee).max(4, "Four referees is plenty.").safeParse(list);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the referee details." };
  return save({ referees: parsed.data });
}

export async function removeAddedSkill(id: string): Promise<ExtrasResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in again to save this." };
  const extras = await getExtras(viewer);
  return save({ added_skills: extras.addedSkills.filter((a) => a.id !== id) });
}

/**
 * From the fit check (D-162): the person says they have something the job asks for that
 * their experience didn't show. Kept apart from their roles, named by them, and used in the
 * Skills section of their CVs. The verdict isn't re-run (no AI cost); the screen marks it.
 */
export async function addSkillFromCheck(input: { jobId: string; jobTitle: string | null; requirement: string; skill: string; note: string }): Promise<{ ok: true; added: AddedSkill } | { ok: false; error: string }> {
  const skill = input.skill.replace(/\s+/g, " ").trim();
  if (skill.length < 2) return { ok: false, error: "Name the skill or tool, for example Power BI." };
  if (skill.length > 60) return { ok: false, error: "Keep the skill short (60 characters). Put the detail in the second box." };
  const note = input.note.replace(/\s+/g, " ").trim().slice(0, 240) || null;
  const banned = lintCopy(`${skill} ${note ?? ""}`).filter((i) => i.kind === "phrase");
  if (banned.length) return { ok: false, error: `Try plainer words than "${banned[0]?.match}".` };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in again to save this." };
  const added: AddedSkill = { id: randomUUID(), skill, note, requirement: input.requirement.slice(0, 240), jobId: input.jobId, jobTitle: input.jobTitle?.slice(0, 160) ?? null, at: new Date().toISOString() };
  if (viewer.preview) return { ok: true, added };
  const extras = await getExtras(viewer);
  if (!extras.ready) return { ok: false, error: NOT_READY };
  if (extras.addedSkills.length >= 80) return { ok: false, error: "You've added a lot of skills. Tidy them on My Experience first." };
  const res = await save({ added_skills: [...extras.addedSkills, added] });
  if (!res.ok) return res;
  revalidatePath(`/jobs/${input.jobId}/check`);
  return { ok: true, added };
}
