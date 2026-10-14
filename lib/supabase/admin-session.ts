import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * The back office's own session (D-136). Same sign in service and accounts as the app,
 * but its own cookie, sent only to /admin pages, so being signed in to the back office
 * never signs anyone in to the app, and the other way round. Signing out of one leaves
 * the other alone.
 */
export const ADMIN_COOKIE = "rcpt-admin-auth";
const cookieOptions = { name: ADMIN_COOKIE, path: "/admin", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };

export async function createAdminSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, { ...options, path: "/admin" });
        } catch {
          // Called from a Server Component. The proxy refreshes the session instead.
        }
      },
    },
  });
}

/** The proxy's refresh for /admin requests: the back office session only. */
export async function updateAdminSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, { ...options, path: "/admin" });
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { response, user };
}
