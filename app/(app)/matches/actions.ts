"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { runMatches, type MatchRun } from "@/lib/jobfeed/match";
import { getJob } from "@/lib/jobs/data";
import { ensureDraftApplication } from "@/lib/applications/pack";
import { track } from "@/lib/analytics/server";

const id = z.string().uuid();

/** Search now (D-205): the daily search, run for the person, at most every 6 hours. */
export async function searchMatches(): Promise<MatchRun | { ran: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ran: false, error: "Please sign in again." };
  const run = await runMatches(viewer, { minHours: 6 });
  revalidatePath("/matches");
  revalidatePath("/home");
  return run;
}

/**
 * Tailor (D-205): the job becomes theirs, like one they added, and goes to the CV, where
 * the CV is written now (or is already there with Tailor ahead). From then on it lives in
 * My Applications.
 */
export async function acceptMatch(matchId: string): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (viewer.preview) return { ok: true, href: "/jobs/demo/cv" };
  if (!id.safeParse(matchId).success) return { ok: false, error: "We couldn't find that job." };
  const supabase = await createClient();
  const { data: m } = await supabase.from("job_matches").select("id, job_id, cv_version_id, match_percent").eq("id", matchId).eq("user_id", viewer.id).maybeSingle();
  if (!m?.job_id) return { ok: false, error: "We couldn't find that job." };
  await supabase.from("jobs").update({ state: "checked" }).eq("id", m.job_id).eq("user_id", viewer.id).eq("state", "suggested");
  if (m.cv_version_id) await ensureDraftApplication(viewer, await getJob(viewer, m.job_id), m.cv_version_id);
  await supabase.from("job_matches").update({ status: "accepted", decided_at: new Date().toISOString() }).eq("id", matchId).eq("user_id", viewer.id);
  await track("match_decided", { decision: "tailor", percent: m.match_percent ?? 0 }, viewer.id);
  revalidatePath("/matches");
  revalidatePath("/applications");
  return { ok: true, href: `/jobs/${m.job_id}/cv` };
}

/** Not for me (D-205): off the list, and never suggested again. */
export async function dismissMatch(matchId: string): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false };
  if (viewer.preview) return { ok: true };
  if (!id.safeParse(matchId).success) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.from("job_matches").update({ status: "dismissed", decided_at: new Date().toISOString() }).eq("id", matchId).eq("user_id", viewer.id).select("match_percent").maybeSingle();
  await track("match_decided", { decision: "dismiss", percent: data?.match_percent ?? 0 }, viewer.id);
  revalidatePath("/matches");
  return { ok: true };
}

/** Tailor ahead (founder round 35): write the CV as soon as a job matches. Off by default. */
export async function setTailorAhead(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (viewer.preview) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ tailor_ahead: Boolean(on) }).eq("id", viewer.id);
  if (error) return { ok: false, error: error.code === "PGRST204" || error.code === "42703" ? "This setting needs the latest database update." : "We couldn't save that. Try again." };
  revalidatePath("/matches");
  revalidatePath("/settings");
  return { ok: true };
}
