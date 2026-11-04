"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { recheckOpen, runMatches, tailorPending, type MatchRun, type TailorRun } from "@/lib/jobfeed/match";
import { stillOpen, type OpenState } from "@/lib/jobfeed/open";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJob } from "@/lib/jobs/data";
import { ensureDraftApplication } from "@/lib/applications/pack";
import { track } from "@/lib/analytics/server";

const id = z.string().uuid();

/** The daily search (D-205), run when they open Jobs for You and the cron hasn't reached them in a day. */
export async function searchMatches(): Promise<MatchRun | { ran: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ran: false, error: "Please sign in again." };
  const run = await runMatches(viewer);
  revalidatePath("/matches");
  revalidatePath("/home");
  return run;
}

/** Tailor ahead (D-209): CVs for the jobs on their list that don't have one yet, a few at a time. */
export async function tailorAheadNow(): Promise<TailorRun> {
  const viewer = await getViewer();
  if (!viewer) return { tailored: 0, left: 0, error: "Please sign in again." };
  const run = await tailorPending(viewer);
  if (run.tailored) revalidatePath("/matches");
  return run;
}

/** Still listed? (founder round 42, D-213): the jobs on their list not checked lately. Closed ones leave it. */
export async function checkOpenNow(): Promise<{ checked: number; closed: number }> {
  const viewer = await getViewer();
  if (!viewer) return { checked: 0, closed: 0 };
  const run = await recheckOpen(viewer);
  if (run.closed) revalidatePath("/matches");
  return run;
}

/**
 * Tailor (D-205): the job becomes theirs, like one they added, and goes to the CV, where
 * the CV is written now (or is already there with Tailor ahead). From then on it lives in
 * My Applications.
 */
export async function acceptMatch(matchId: string): Promise<{ ok: true; href: string } | { ok: false; error: string; closed?: true }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (viewer.preview) return { ok: true, href: "/jobs/demo/cv" };
  if (!id.safeParse(matchId).success) return { ok: false, error: "We couldn't find that job." };
  const supabase = await createClient();
  const { data: m } = await supabase.from("job_matches").select("*").eq("id", matchId).eq("user_id", viewer.id).maybeSingle();
  if (!m?.job_id) return { ok: false, error: "We couldn't find that job." };
  // Still listed? (founder round 42.) Asked now unless checked open in the last hour; a slow
  // answer doesn't hold them up. Before migration section 28, "open_state" isn't there to keep it.
  if ("open_state" in m && !(m.open_state === "open" && m.open_checked_at && Date.now() - Date.parse(m.open_checked_at) < 3_600_000)) {
    const state = await Promise.race([stillOpen({ source: m.source, sourceId: m.source_job_id, url: m.url }), new Promise<OpenState>((done) => setTimeout(() => done("unknown"), 6_000))]);
    await createAdminClient().from("job_matches").update({ open_state: state, open_checked_at: new Date().toISOString() }).eq("id", matchId).eq("user_id", viewer.id);
    if (state === "closed") {
      revalidatePath("/matches");
      return { ok: false, error: "This job has closed, so we've taken it off your list.", closed: true };
    }
  }
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
