import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { canCorrect, canTransition, CLOSED, type ApplicationStatus } from "@/lib/rules/status-flow";
import { nextCheckIn, type ScheduleKind } from "./schedule";
import { track } from "@/lib/analytics/server";
import { LIMITS } from "@/lib/config";

export type { OutcomeSource } from "./outcome-rules";
import type { OutcomeSource } from "./outcome-rules";

const DAY = 86_400_000;

/**
 * Every status change goes through here: the deterministic status flow decides what is
 * allowed, and each change writes an append only outcome event (Build pack section 4).
 */
export async function changeStatus(
  viewer: Viewer,
  applicationId: string,
  to: ApplicationStatus,
  opts: { source: OutcomeSource; evidence?: string | null; verified?: boolean; correction?: boolean } = { source: "tap" },
): Promise<{ ok: true; from: ApplicationStatus } | { error: string }> {
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id, status, sent_at").eq("id", applicationId).eq("user_id", viewer.id).maybeSingle();
  if (!app) return { error: "We couldn't find this application." };
  const from = app.status as ApplicationStatus;
  if (from === to) return { ok: true, from };
  // A board correction may go back or skip stages (D-202); everything else follows the flow.
  if (opts.correction ? !canCorrect(from, to) || to === "draft" || to === "packed" || (to !== "sent" && !app.sent_at) : !canTransition(from, to)) return { error: "That update doesn't fit where this application is now." };

  const { error } = await supabase
    .from("applications")
    .update({ status: to, status_verified: Boolean(opts.verified), next_check_in_at: null, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("user_id", viewer.id);
  if (error) return { error: "We couldn't save that. Try again." };
  await supabase.from("outcome_events").insert({ application_id: applicationId, user_id: viewer.id, from_status: from, to_status: to, source: opts.source, evidence_text: opts.evidence?.slice(0, 2000) ?? null });
  const days = app.sent_at ? Math.max(0, Math.floor((Date.now() - new Date(app.sent_at).getTime()) / DAY)) : 0;
  await track("outcome_logged", { to_status: to, source: opts.source, days_since_sent: days }, viewer.id);
  return { ok: true, from };
}

/**
 * Back to "not sent" from the board (D-202): an undo of "sent", for a job marked sent by
 * mistake. It goes back to Ready to Send when it has a pack, otherwise to the CV. The job
 * post copy and the CV stay as they were.
 */
export async function unsend(viewer: Viewer, applicationId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id, status, pack_id").eq("id", applicationId).eq("user_id", viewer.id).maybeSingle();
  if (!app) return { error: "We couldn't find this application." };
  const from = app.status as ApplicationStatus;
  if (from === "draft" || from === "packed") return { ok: true };
  if (CLOSED.includes(from)) return { error: "This application is closed." };
  const to: ApplicationStatus = app.pack_id ? "packed" : "draft";
  const row = { status: to, sent_at: null, next_check_in_at: null, status_verified: false, updated_at: new Date().toISOString() };
  let { error } = await supabase.from("applications").update({ ...row, sent_via: null }).eq("id", applicationId).eq("user_id", viewer.id);
  if (error && (error.code === "PGRST204" || error.code === "42703")) ({ error } = await supabase.from("applications").update(row).eq("id", applicationId).eq("user_id", viewer.id));
  if (error) return { error: "We couldn't save that. Try again." };
  await supabase.from("outcome_events").insert({ application_id: applicationId, user_id: viewer.id, from_status: from, to_status: to, source: "tap" });
  await track("outcome_logged", { to_status: to, source: "tap", days_since_sent: 0 }, viewer.id);
  return { ok: true };
}

/** "No reply yet": ask once more on the schedule, then let the 30 day rule take over. */
export async function snoozeCheckIn(viewer: Viewer, applicationId: string): Promise<void> {
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id, status, sent_at, check_ins_done, schedule_kind, job_snapshot").eq("id", applicationId).eq("user_id", viewer.id).maybeSingle();
  if (!app || app.status !== "sent" || !app.sent_at) return;
  const done = (app.check_ins_done ?? 0) + 1;
  const deadline = (app.job_snapshot as { parsed?: { deadline?: string | null } } | null)?.parsed?.deadline ?? null;
  const next = nextCheckIn(app.schedule_kind as ScheduleKind, new Date(app.sent_at), deadline, done);
  // Never more than one reminder a week, whatever the schedule says.
  const floor = Date.now() + 7 * DAY;
  const at = next ? new Date(Math.max(next.getTime(), floor)) : null;
  await supabase.from("applications").update({ check_ins_done: done, next_check_in_at: at?.toISOString() ?? null }).eq("id", applicationId).eq("user_id", viewer.id);
}

/**
 * No reply after 30 days, done on read as well as by the daily job, so the home card
 * never shows an application older than the window even if the job hasn't run.
 * The person can still move it on later (a late invite reopens it).
 */
export async function closeSilent(viewer: Viewer): Promise<number> {
  if (viewer.preview) return 0;
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - LIMITS.checkins.no_response_after_days * DAY).toISOString();
  const { data } = await supabase.from("applications").select("id").eq("user_id", viewer.id).eq("status", "sent").lt("sent_at", cutoff).limit(20);
  if (!data?.length) return 0;
  // A job the person moved back to "sent" themselves (D-202) stays where they put it.
  const { data: moved } = await supabase
    .from("outcome_events")
    .select("application_id")
    .eq("user_id", viewer.id)
    .in("application_id", data.map((a) => a.id))
    .eq("to_status", "sent")
    .eq("source", "tap")
    .not("from_status", "in", "(draft,packed)");
  const keep = new Set((moved ?? []).map((m) => m.application_id));
  const close = data.filter((a) => !keep.has(a.id));
  for (const a of close) await changeStatus(viewer, a.id, "no_response", { source: "auto_30d" });
  return close.length;
}
