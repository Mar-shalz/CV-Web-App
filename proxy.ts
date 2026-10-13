import { NextResponse, NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { buildCsp, newNonce } from "@/lib/csp";

const APP_PREFIXES = ["/home", "/jobs", "/applications", "/vault", "/settings", "/onboarding", "/pass"];
const AUTH_PREFIXES = ["/sign-in"];
// The back office has its own sign in page, and signed out visits to /admin go there.
const ADMIN_SIGN_IN = "/admin/sign-in";

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

  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin")) {
    const onSignIn = path === ADMIN_SIGN_IN || path.startsWith(`${ADMIN_SIGN_IN}/`);
    if (!user && !onSignIn) return NextResponse.redirect(new URL(ADMIN_SIGN_IN, request.url));
    if (user && onSignIn && !request.nextUrl.searchParams.has("signed_out")) return NextResponse.redirect(new URL("/admin", request.url));
    return withCsp(response);
  }

  if (!user && APP_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && AUTH_PREFIXES.some((p) => path.startsWith(p)) && !request.nextUrl.searchParams.has("signed_out")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
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
