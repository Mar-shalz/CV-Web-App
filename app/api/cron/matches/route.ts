import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withClient } from "@/lib/supabase/server";
import { safeEqual } from "@/lib/secure-compare";
import { extViewer } from "@/lib/ext/viewer";
import { runMatches } from "@/lib/jobfeed/match";
import { LIMITS } from "@/lib/config";

export const maxDuration = 300;

/**
 * Daily (vercel.json): Jobs for you for people active in the last two weeks whose search
 * is a day old, a few each run, oldest search first (D-205). Everyone else gets theirs when
 * they open Jobs for You. Vercel sends CRON_SECRET as a bearer token.
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
  const { data: users } = await db.from("users").select("id, email, target_markets, matches_searched_at").in("id", ids.slice(0, 1000)).order("matches_searched_at", { ascending: true, nullsFirst: true }).limit(LIMITS.matches.cron_users_per_run);
  let ran = 0;
  for (const u of users ?? []) {
    const viewer = await extViewer(db, { id: u.id, email: u.email ?? "", name: null, targetMarkets: (u.target_markets as string[] | null) ?? ["NG"], preview: false });
    const res = await withClient(db, () => runMatches(viewer)).catch(() => null);
    if (res?.ran) ran++;
  }
  return NextResponse.json({ ok: true, ran });
}
