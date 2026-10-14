import { NextResponse, type NextRequest } from "next/server";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

// The back office's own sign in callback (D-136): Google, or the link in the email, land
// here with a one time code that becomes a back office session only. Never an app session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const failed = `${origin}/admin/sign-in?error=${searchParams.get("method") === "email" ? "link" : "google"}`;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(failed);
  const supabase = await createAdminSessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failed);
  // Only ever our own fixed path.
  return NextResponse.redirect(`${origin}/admin`);
}
