import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isSupabaseConfigured } from "@/lib/env";

const APP_PREFIXES = ["/home", "/jobs", "/applications", "/vault", "/settings", "/onboarding", "/pass", "/admin"];
const AUTH_PREFIXES = ["/sign-in"];

export async function proxy(request: NextRequest) {
  // Without Supabase there is no session to refresh (local preview only, see lib/env.ts).
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Service not configured", { status: 503 });
    }
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (!user && APP_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && AUTH_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|offline|.*\\.(?:svg|png|jpg|webp|ico|txt|xml)$).*)"],
};
