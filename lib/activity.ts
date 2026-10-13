import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One row per person per day (Lagos time) with a visit count and the country the visit
 * came from, so the back office can see how often people use the app. The country is
 * the two letter code from the host's IP lookup (Vercel); no IP address, city, pages,
 * content or device is stored. Never throws: counting must not break a page.
 */
export async function recordVisit(userId: string, country: string | null): Promise<void> {
  const code = country && /^[A-Z]{2}$/.test(country) ? country : null;
  try {
    await createAdminClient().rpc("touch_activity", { p_user: userId, p_country: code });
  } catch {
    // Missing key or table (migration not run yet): skip.
  }
}
