import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One row per person per day (Lagos time) with a visit count, so the back office can
 * see how often people use the app. No pages, content or devices are stored. Never
 * throws: activity counting must not break a page.
 */
export async function recordVisit(userId: string): Promise<void> {
  try {
    await createAdminClient().rpc("touch_activity", { p_user: userId });
  } catch {
    // Missing key or table (migration not run yet): skip.
  }
}
