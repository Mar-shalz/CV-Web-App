"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { isPreviewMode } from "@/lib/env";
import { LEGAL, LIMITS, MARKETS } from "@/lib/config";
import { marketsFor } from "@/lib/markets";
import { getViewer, nextOnboardingPath } from "@/lib/auth/viewer";
import { track } from "@/lib/analytics/server";
import { NEXT_COOKIE, isReturnPath } from "@/lib/auth/next-path";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

// The email between "send code" and "enter code" lives in a short lived httpOnly
// cookie, never in the URL (D-003).
const OTP_COOKIE = "rcpt_otp_email";
// Set when sign in starts from the back office's own sign in (/admin/sign-in). The back office
// keeps its own session (D-136), so its sign in uses its own client and callback.
const DEST_COOKIE = "rcpt_dest";
const isAdminDest = (formData?: FormData | null) => formData?.get("dest") === "admin";
const authClient = (admin: boolean) => (admin ? createAdminSessionClient() : createClient());

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Sign in errors never reveal whether an account exists.
const GENERIC_AUTH_ERROR = "We couldn't sign you in just now. Check your connection and try again.";

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------
export async function signInWithGoogle(_prev?: FormState, formData?: FormData): Promise<FormState> {
  const admin = isAdminDest(formData);
  if (isPreviewMode()) redirect(admin ? "/admin" : "/onboarding/consent");
  const supabase = await authClient(admin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}${admin ? "/admin/auth/callback" : "/auth/callback"}`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) return { error: GENERIC_AUTH_ERROR };
  redirect(data.url);
}

// ---------------------------------------------------------------------------
// Email one time code
// ---------------------------------------------------------------------------
const emailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Enter an email address like name@gmail.com" })),
});

export async function sendEmailCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email" } };
  const { email } = parsed.data;
  const admin = isAdminDest(formData);

  if (!isPreviewMode()) {
    const supabase = await authClient(admin);
    // The email carries a 6 digit code when the template has {{ .Token }}, and a sign in
    // link either way; the link lands on /auth/callback (D-069).
    // The back office never creates accounts: a team member is added to an existing one.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: !admin, emailRedirectTo: await linkTarget(admin) } });
    if (error) {
      if (error.status === 429) return { error: "Too many codes asked for. Wait a minute, then try again." };
      return { error: GENERIC_AUTH_ERROR };
    }
  }

  (await cookies()).set(OTP_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LIMITS.auth.otp_cookie_minutes * 60,
  });
  const jar = await cookies();
  if (admin) jar.set(DEST_COOKIE, "admin", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: LIMITS.auth.otp_cookie_minutes * 60 });
  else jar.delete(DEST_COOKIE);
  redirect(admin ? "/admin/sign-in/verify" : "/sign-in/verify");
}

async function linkTarget(admin: boolean): Promise<string> {
  return `${await origin()}${admin ? "/admin/auth/callback" : "/auth/callback"}?method=email`;
}

export async function resendEmailCode(): Promise<FormState> {
  const jar = await cookies();
  const email = jar.get(OTP_COOKIE)?.value;
  const admin = jar.get(DEST_COOKIE)?.value === "admin";
  if (!email) redirect(admin ? "/admin/sign-in" : "/sign-in");
  if (isPreviewMode()) return { ok: true };
  const supabase = await authClient(admin);
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: !admin, emailRedirectTo: await linkTarget(admin) } });
  if (error) {
    if (error.status === 429) return { error: "Please wait a little before asking for another code." };
    return { error: GENERIC_AUTH_ERROR };
  }
  return { ok: true };
}

const codeSchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().length(LIMITS.auth.otp_length, { message: `Enter the ${LIMITS.auth.otp_length} digit code from your email` })),
});

export async function verifyEmailCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const email = jar.get(OTP_COOKIE)?.value;
  if (!email) return { error: "Your code timed out. Go back and ask for a new one." };

  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { fieldErrors: { code: parsed.error.issues[0]?.message ?? "Enter the code" } };

  const admin = jar.get(DEST_COOKIE)?.value === "admin";
  if (isPreviewMode()) {
    jar.delete(OTP_COOKIE);
    jar.delete(DEST_COOKIE);
    redirect(admin ? "/admin" : "/onboarding/consent");
  }

  const supabase = await authClient(admin);
  const { data, error } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: "email" });
  if (error || !data.user) {
    return { fieldErrors: { code: "That code didn't work. Check it, or ask for a new one." } };
  }
  jar.delete(OTP_COOKIE);
  jar.delete(DEST_COOKIE);
  // Back office sign in: straight to /admin, which asks for the authenticator code next.
  if (admin) redirect("/admin");

  const viewer = await getViewer();
  if (viewer && !viewer.consentDone) await track("signup_completed", { method: "email" }, viewer.id);
  const next = jar.get(NEXT_COOKIE)?.value;
  if (next) jar.delete(NEXT_COOKIE);
  const onboarding = viewer ? nextOnboardingPath(viewer) : "/home";
  redirect(onboarding === "/home" && isReturnPath(next) ? next : onboarding);
}

// ---------------------------------------------------------------------------
// Consent (screen 3)
// ---------------------------------------------------------------------------
export async function saveConsent(_prev: FormState, formData: FormData): Promise<FormState> {
  const terms = formData.get("terms") === "on";
  const privacy = formData.get("privacy") === "on";
  const adult = formData.get("adult") === "on";
  const marketing = formData.get("marketing") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!adult) fieldErrors.adult = `You need to be ${LIMITS.onboarding.min_age_years} or older to use this app.`;
  if (!terms) fieldErrors.terms = "Tick to agree to the terms.";
  if (!privacy) fieldErrors.privacy = "Tick to agree to how we handle your data.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  if (isPreviewMode()) redirect("/onboarding/setup");

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const supabase = await createClient();
  const now = new Date().toISOString();
  const rows = (["terms", "privacy", "marketing"] as const).map((type) => ({
    user_id: viewer.id,
    type,
    version: LEGAL.consents[type].version,
    granted_at: type === "marketing" ? (marketing ? now : null) : now,
  }));
  const [{ error: consentError }, { error: userError }] = await Promise.all([
    supabase.from("consents").insert(rows),
    supabase.from("users").update({ age_confirmed_at: now }).eq("id", viewer.id),
  ]);
  if (consentError || userError) return { error: "We couldn't save that. Check your connection and try again." };

  await Promise.all(rows.map((r) => track("consent_updated", { type: r.type, granted: Boolean(r.granted_at) }, viewer.id)));
  redirect(viewer.setupDone ? "/home" : "/onboarding/setup");
}

// ---------------------------------------------------------------------------
// Setup (screen 4)
// ---------------------------------------------------------------------------
const stageIds = MARKETS.career_stages.map((s) => s.id) as [string, ...string[]];

const setupSchema = z.object({
  career_stage: z.enum(stageIds, { message: "Choose where you are right now." }),
  region: z.enum(["nigeria", "abroad", "both"], { message: "Choose where you're applying." }),
  low_data_mode: z.boolean(),
});

export async function saveSetup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse({
    career_stage: formData.get("career_stage"),
    region: formData.get("region"),
    low_data_mode: formData.get("low_data_mode") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const { career_stage, region, low_data_mode } = parsed.data;
  // No country list: the job post decides the country for each CV (D-085).
  const target_markets = marketsFor(region);

  if (isPreviewMode()) redirect("/home");

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ career_stage, target_markets, low_data_mode, ...(viewer.setupDone ? {} : { setup_completed_at: new Date().toISOString() }) })
    .eq("id", viewer.id);
  if (error) return { error: "We couldn't save your setup. Check your connection and try again." };

  // Opened again from Settings: back there. First time: on to Home.
  if (viewer.setupDone) redirect("/settings");
  await track("setup_completed", { career_stage, target_markets_count: target_markets.length }, viewer.id);
  redirect("/home");
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOut(): Promise<void> {
  if (!isPreviewMode()) {
    const supabase = await createClient();
    // This browser's app session only; the back office has its own (D-136).
    await supabase.auth.signOut({ scope: "local" });
  }
  // The service worker sees this and deletes the applications it kept for offline use.
  redirect("/sign-in?signed_out=1");
}
