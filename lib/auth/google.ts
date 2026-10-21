import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Google sign in on our own address (founder, round 25, D-187). Through Supabase's own
// Google sign in, Google's screen says "to continue to <project>.supabase.co", a random
// address that looks like phishing. Here Google sends the person back to us, so it shows
// our address (or the app name, once Google has verified the brand). We swap Google's one
// time code for its signed ID token, and Supabase checks that token and starts the session.
// PKCE, a state value and a nonce guard each step. Without GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET set, sign in falls back to Supabase's flow, as before.

export const GOOGLE_COOKIE = "rcpt_google";
export const GOOGLE_CALLBACK = "/auth/google";

type Pending = { state: string; nonce: string; verifier: string; dest: "app" | "admin" };

/**
 * On when the keys are set, and only on the app's own address (APP_URL), whose callback is
 * the one registered with Google. Any other address (an old one, a preview copy) uses
 * Supabase's flow: Google refuses a callback it doesn't know ("redirect_uri_mismatch",
 * founder round 27, when the extension still opened the old address).
 */
export function googleDirectFor(origin: string): boolean {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return false;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  try {
    return Boolean(process.env.APP_URL) && new URL(process.env.APP_URL as string).origin === origin;
  } catch {
    return false;
  }
}

/** Google's sign in address, and the cookie that remembers this attempt for ten minutes. */
export function startGoogle(origin: string, dest: "app" | "admin"): { url: string; cookie: string } {
  const pending: Pending = { state: randomBytes(24).toString("base64url"), nonce: randomBytes(24).toString("base64url"), verifier: randomBytes(32).toString("base64url"), dest };
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}${GOOGLE_CALLBACK}`,
    response_type: "code",
    scope: "openid email profile",
    state: pending.state,
    // Google puts the nonce in the ID token as given; Supabase hashes ours and compares.
    nonce: createHash("sha256").update(pending.nonce).digest("hex"),
    code_challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, cookie: JSON.stringify(pending) };
}

export function readPending(raw: string | undefined, state: string | null): Pending | null {
  if (!raw || !state) return null;
  try {
    const p = JSON.parse(raw) as Pending;
    const a = Buffer.from(p.state ?? "");
    const b = Buffer.from(state);
    return a.length === b.length && timingSafeEqual(a, b) && p.nonce && p.verifier ? p : null;
  } catch {
    return null;
  }
}

/** Swaps Google's one time code for its signed ID token. Null when Google says no. */
export async function googleIdToken(origin: string, code: string, verifier: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: `${origin}${GOOGLE_CALLBACK}`,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id_token?: string };
    return typeof data.id_token === "string" ? data.id_token : null;
  } catch {
    return null;
  }
}
