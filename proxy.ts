import { NextResponse, NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { updateAdminSession } from "@/lib/supabase/admin-session";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { buildCsp, newNonce } from "@/lib/csp";

const APP_PREFIXES = ["/home", "/jobs", "/applications", "/experience", "/settings", "/onboarding", "/pass", "/extension"];
const AUTH_PREFIXES = ["/sign-in"];

export async function proxy(incoming: NextRequest) {
  // A new nonce for every page. Next reads it from the request's CSP header and puts it
  // on its own scripts; the same policy goes on the response.
  const nonce = newNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development", supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
  const headers = new Headers(incoming.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const request = new NextRequest(incoming, { headers });
  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  // Without Supabase there is no session to refresh (local preview only, see lib/env.ts).
  if (!isSupabaseConfigured() || isPreviewMode()) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Service not configured", { status: 503 });
    }
    return withCsp(NextResponse.next({ request: { headers } }));
  }

  const path = request.nextUrl.pathname;

  // The back office keeps its own session (D-136): only its cookie counts on /admin pages.
  if (path === "/admin" || path.startsWith("/admin/")) {
    const { response, user } = await updateAdminSession(request);
    const open = path.startsWith("/admin/sign-in") || path.startsWith("/admin/auth/");
    if (!user && !open) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/sign-in";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return withCsp(response);
  }

  const { response, user } = await updateSession(request);

  if (!user && APP_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Old back office links to the app's sign in go to the back office's own.
  if (path === "/sign-in" && request.nextUrl.searchParams.get("to") === "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && AUTH_PREFIXES.some((p) => path.startsWith(p)) && !request.nextUrl.searchParams.has("signed_out")) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.searchParams.get("from") === "price" ? "/pass" : "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return withCsp(response);
}

export const config = {
  matcher: [
    {
      source: "/((?!api/payments|api/cron|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|webp|ico|txt|xml|woff2)$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
    },
  ],
};
