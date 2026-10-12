import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS } from "@/lib/config";
import { track } from "@/lib/analytics/server";

/**
 * The 3 day trial starts at the first job check, not at sign up (Build pack decision 15).
 * Written with the service role: users can read their usage counter but never write it.
 */
export async function startTrialIfNeeded(viewer: Viewer): Promise<void> {
  if (viewer.preview || viewer.trial.startedAt || viewer.activePass) return;
  const now = new Date();
  const ends = new Date(now.getTime() + LIMITS.trial.days * 86_400_000);
  const { data } = await createAdminClient()
    .from("usage_counters")
    .update({ trial_started_at: now.toISOString(), trial_ends_at: ends.toISOString() })
    .eq("user_id", viewer.id)
    .is("trial_started_at", null)
    .select("user_id");
  if (data?.length) await track("trial_started", { trigger: "first_job_check" }, viewer.id);
}
