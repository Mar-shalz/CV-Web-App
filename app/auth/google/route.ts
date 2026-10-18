import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { getViewer, nextOnboardingPath } from "@/lib/auth/viewer";
import { track } from "@/lib/analytics/server";
import { NEXT_COOKIE, isReturnPath } from "@/lib/auth/next-path";
import { GOOGLE_COOKIE, googleIdToken, readPending } from "@/lib/auth/google";

// Google sends people back here when they sign in on our own address (D-187). The code
// becomes Google's ID token, and Supabase checks it and starts the session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const pending = readPending(request.cookies.get(GOOGLE_COOKIE)?.value, searchParams.get("state"));
  const admin = pending?.dest === "admin";
  const failed = NextResponse.redirect(`${origin}${admin ? "/admin/sign-in" : "/sign-in"}?error=google`);
  // The attempt's cookie lives on this path only, so it is cleared on the same path.
  const clear = (res: NextResponse) => (res.cookies.set(GOOGLE_COOKIE, "", { path: "/auth/google", maxAge: 0 }), res);
  clear(failed);
  const code = searchParams.get("code");
  if (!pending || !code) return failed;

  const token = await googleIdToken(origin, code, pending.verifier);
  if (!token) return failed;
  // The back office keeps its own session (D-136).
  const supabase = admin ? await createAdminSessionClient() : await createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token, nonce: pending.nonce });
  if (error) return failed;

  if (admin) {
    return clear(NextResponse.redirect(`${origin}/admin`));
  }
  const viewer = await getViewer();
  if (!viewer) return failed;
  if (!viewer.consentDone) await track("signup_completed", { method: "google" }, viewer.id);
  // Only ever redirect to our own fixed paths, never to a caller supplied URL.
  const next = request.cookies.get(NEXT_COOKIE)?.value;
  const onboarding = nextOnboardingPath(viewer);
  const res = NextResponse.redirect(`${origin}${onboarding === "/home" && isReturnPath(next) ? next : onboarding}`);
  if (next) res.cookies.delete(NEXT_COOKIE);
  return clear(res);
}
