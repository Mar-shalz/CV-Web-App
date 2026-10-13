import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, PRICES } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { notify } from "./data";

const DAY = 86_400_000;

/**
 * Daily reminders for the Updates panel: a pass about to end, a pass that ended, a
 * trial ending tomorrow. Each has a dedupe key, so running twice sends nothing new.
 */
export async function sendReminders(now: Date = new Date()): Promise<number> {
  const db = createAdminClient();
  const soon = new Date(now.getTime() + LIMITS.notifications.pass_ending_days * DAY).toISOString();
  const nowIso = now.toISOString();
  const dayAgo = new Date(now.getTime() - DAY).toISOString();
  let sent = 0;

  const { data: ending } = await db.from("passes").select("id, user_id, ends_at").eq("status", "active").eq("type", "job_hunt_30d").gt("ends_at", nowIso).lte("ends_at", soon).limit(500);
  for (const p of ending ?? []) {
    const days = Math.max(1, Math.ceil((new Date(p.ends_at).getTime() - now.getTime()) / DAY));
    await notify(p.user_id, {
      kind: "pass",
      title: days === 1 ? "Your pass ends tomorrow" : `Your pass ends in ${days} days`,
      body: `It ends on ${formatDate(p.ends_at)}. Still applying? Get another ${PRICES.products.job_hunt_30d.days} days any time. Your experience and applications stay free either way.`,
      link: "/pass",
      dedupeKey: `pass_ending:${p.id}`,
    });
    sent++;
  }

  const { data: ended } = await db.from("passes").select("id, user_id").eq("status", "active").eq("type", "job_hunt_30d").gt("ends_at", dayAgo).lte("ends_at", nowIso).limit(500);
  for (const p of ended ?? []) {
    await notify(p.user_id, {
      kind: "pass",
      title: "Your pass has ended",
      body: "Your experience, applications and check ins stay free. Get a new pass when you're ready to tailor more CVs.",
      link: "/pass",
      dedupeKey: `pass_ended:${p.id}`,
    });
    sent++;
  }

  const { data: trials } = await db.from("usage_counters").select("user_id, trial_ends_at").gt("trial_ends_at", nowIso).lte("trial_ends_at", new Date(now.getTime() + DAY).toISOString()).limit(500);
  for (const t of trials ?? []) {
    await notify(t.user_id, {
      kind: "trial",
      title: "Your free trial ends tomorrow",
      body: "Tailor any CVs you need today. Your experience, job checks and applications stay free after the trial.",
      link: "/pass",
      dedupeKey: `trial_ending:${t.user_id}`,
    });
    sent++;
  }
  return sent;
}
