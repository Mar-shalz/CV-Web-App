import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS } from "@/lib/config";
import { safeEqual } from "@/lib/secure-compare";
import { sendReminders } from "@/lib/notifications/reminders";

/**
 * Daily job (vercel.json): applications sent 30 or more days ago with no reply become
 * No reply, with an auto_30d outcome event; then pass and trial reminders go to the
 * Updates panel. Vercel sends CRON_SECRET as a bearer token.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ ok: false }, { status: 401 });

  const { data, error } = await createAdminClient().rpc("mark_silent_applications", { p_days: LIMITS.checkins.no_response_after_days });
  if (error) return NextResponse.json({ ok: false, error: "rpc_failed" }, { status: 500 });
  const reminders = await sendReminders().catch(() => -1);
  return NextResponse.json({ ok: true, marked: data ?? 0, reminders });
}
