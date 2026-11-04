import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer, nextOnboardingPath } from "@/lib/auth/viewer";
import { track } from "@/lib/analytics/server";
import { NEXT_COOKIE, isReturnPath } from "@/lib/auth/next-path";
import { reportOps } from "@/lib/ops";

/**
 * Why a sign in didn't finish, as a short code for the back office (founder round 43): Google
 * sign in failed after Google with no word why. No email, address or token is kept.
 */
function failure(method: string, reason: string, request: NextRequest) {
  const verifiers = request.cookies.getAll().filter((c) => c.name.endsWith("-code-verifier")).length;
  return reportOps("sign_in_failed", { method, reason: reason.slice(0, 60), verifiers, flow: request.nextUrl.searchParams.has("sb_flow_id") ? "yes" : "no" }).catch(() => undefined);
}

// Google sign in, and the sign in link in our emails, land here with a one time code
// to swap for a session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const method = searchParams.get("method") === "email" ? "email" : "google";
  // Old back office links used ?dest=admin here; the back office now has its own callback (D-136).
  if (searchParams.get("dest") === "admin") return NextResponse.redirect(`${origin}/admin/sign-in`);
  const failed = `${origin}/sign-in?error=${method === "email" ? "link" : "google"}`;
  const code = searchParams.get("code");
  if (!code) {
    await failure(method, searchParams.get("error_code") ?? searchParams.get("error") ?? "no_code", request);
    return NextResponse.redirect(failed);
  }

  // The sign in names its own saved key (sb_flow_id), so a second tap on Continue with Google
  // can't swap in the other attempt's key. Older links without it use the latest one.
  const supabase = await createClient();
  const flowId = searchParams.get("sb_flow_id");
  let { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (error?.code === "pkce_code_verifier_not_found" && flowId) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  if (error) {
    await failure(method, error.code ?? error.name ?? "exchange_failed", request);
    return NextResponse.redirect(failed);
  }

  const viewer = await getViewer();
  if (!viewer) {
    await failure(method, "no_viewer", request);
    return NextResponse.redirect(failed);
  }
  if (!viewer.consentDone) await track("signup_completed", { method }, viewer.id);

  // Only ever redirect to our own fixed paths, never to a caller supplied URL.
  const next = request.cookies.get(NEXT_COOKIE)?.value;
  const onboarding = nextOnboardingPath(viewer);
  const res = NextResponse.redirect(`${origin}${onboarding === "/home" && isReturnPath(next) ? next : onboarding}`);
  if (next) res.cookies.delete(NEXT_COOKIE);
  return res;
}
