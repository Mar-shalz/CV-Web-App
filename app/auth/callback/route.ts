import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer, nextOnboardingPath } from "@/lib/auth/viewer";
import { track } from "@/lib/analytics/server";
import { NEXT_COOKIE, isReturnPath } from "@/lib/auth/next-path";

// Google sign in, and the sign in link in our emails, land here with a one time code
// to swap for a session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const method = searchParams.get("method") === "email" ? "email" : "google";
  // Old back office links used ?dest=admin here; the back office now has its own callback (D-136).
  if (searchParams.get("dest") === "admin") return NextResponse.redirect(`${origin}/admin/sign-in`);
  const failed = `${origin}/sign-in?error=${method === "email" ? "link" : "google"}`;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(failed);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failed);

  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(failed);
  if (!viewer.consentDone) await track("signup_completed", { method }, viewer.id);

  // Only ever redirect to our own fixed paths, never to a caller supplied URL.
  const next = request.cookies.get(NEXT_COOKIE)?.value;
  const onboarding = nextOnboardingPath(viewer);
  const res = NextResponse.redirect(`${origin}${onboarding === "/home" && isReturnPath(next) ? next : onboarding}`);
  if (next) res.cookies.delete(NEXT_COOKIE);
  return res;
}
