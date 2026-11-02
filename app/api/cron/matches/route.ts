import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withClient } from "@/lib/supabase/server";
import { safeEqual } from "@/lib/secure-compare";
import { extViewer } from "@/lib/ext/viewer";
import { runMatches } from "@/lib/jobfeed/match";
import { LIMITS } from "@/lib/config";

export const maxDuration = 300;

/**
 * Jobs for You for people active in the last two weeks whose search is a day old, oldest
 * first (D-205). vercel.json calls this every two hours as separate daily jobs (the Hobby
 * plan allows only daily ones), so everyone gets a search each day without opening the page
 * (founder round 40, D-211). A few people a run, side by side: each search caps its own
 * time. Anyone missed still gets theirs when they open Jobs for You. Vercel sends
 * CRON_SECRET as a bearer token.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ ok: false }, { status: 401 });
  const db = createAdminClient();
  const since = new Date(Date.now() - LIMITS.matches.active_days * 86_400_000).toISOString().slice(0, 10);
  const { data: active } = await db.from("user_activity").select("user_id").gte("day", since).limit(2000);
  const ids = [...new Set((active ?? []).map((a) => a.user_id as string))];
  if (!ids.length) return NextResponse.json({ ok: true, ran: 0 });
  const due = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const { data: users } = await db
    .from("users")
    .select("id, email, target_markets, matches_searched_at")
    .in("id", ids.slice(0, 1000))
    .or(`matches_searched_at.is.null,matches_searched_at.lt.${due}`)
    .order("matches_searched_at", { ascending: true, nullsFirst: true })
    .limit(LIMITS.matches.cron_users_per_run);
  const runs = await Promise.all(
    (users ?? []).map(async (u) => {
      const viewer = await extViewer(db, { id: u.id, email: u.email ?? "", name: null, targetMarkets: (u.target_markets as string[] | null) ?? ["NG"], preview: false });
      return withClient(db, () => runMatches(viewer)).catch(() => null);
    }),
  );
  return NextResponse.json({ ok: true, ran: runs.filter((r) => r?.ran).length });
}
