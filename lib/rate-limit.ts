import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/env";

// Per user limits on AI endpoints (Build pack section 10). Values are config, not code.
export const LIMITS_PER_HOUR = {
  cv_import: 10,
  interview: 60,
  job_parse: 30,
  job_check: 30,
  tailor: 20,
  pack: 30,
  classify: 30,
  shortlist: 20,
  drill: 60,
} as const;

export type RateBucket = keyof typeof LIMITS_PER_HOUR;

/** True when the call may go ahead. Fails open only in local preview mode. */
export async function allow(bucket: RateBucket): Promise<boolean> {
  if (isPreviewMode()) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rate_limit_hit", { p_bucket: bucket, p_max: LIMITS_PER_HOUR[bucket], p_window_seconds: 3600 });
  if (error) return false;
  return data === true;
}

export const RATE_LIMITED_MESSAGE = "You've done a lot in the last hour. Take a short break and try again soon.";
