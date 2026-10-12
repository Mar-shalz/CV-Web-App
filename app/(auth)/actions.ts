"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/env";
import { LEGAL, LIMITS, MARKETS } from "@/lib/config";
import { getViewer, nextOnboardingPath } from "@/lib/auth/viewer";
import { track } from "@/lib/analytics/server";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

// The email between "send code" and "enter code" lives in a short lived httpOnly
// cookie, never in the URL (D-003).
const OTP_COOKIE = "rcpt_otp_email";

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
export async function signInWithGoogle(): Promise<FormState> {
  if (isPreviewMode()) redirect("/onboarding/consent");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback`, queryParams: { prompt: "select_account" } },
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

  if (!isPreviewMode()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
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
  redirect("/sign-in/verify");
}

export async function resendEmailCode(): Promise<FormState> {
  const email = (await cookies()).get(OTP_COOKIE)?.value;
  if (!email) redirect("/sign-in");
  if (isPreviewMode()) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
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

  if (isPreviewMode()) {
    jar.delete(OTP_COOKIE);
    redirect("/onboarding/consent");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: "email" });
  if (error || !data.user) {
    return { fieldErrors: { code: "That code didn't work. Check it, or ask for a new one." } };
  }
  jar.delete(OTP_COOKIE);

  const viewer = await getViewer();
  if (viewer && !viewer.consentDone) await track("signup_completed", { method: "email" }, viewer.id);
  redirect(viewer ? nextOnboardingPath(viewer) : "/home");
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
const countryCodes = MARKETS.countries.map((c) => c.code) as [string, ...string[]];

const setupSchema = z
  .object({
    career_stage: z.enum(stageIds, { message: "Choose where you are right now." }),
    region: z.enum(["nigeria", "abroad", "both"], { message: "Choose where you're applying." }),
    countries: z.array(z.enum(countryCodes)).max(LIMITS.onboarding.max_target_countries, {
      message: `Pick up to ${LIMITS.onboarding.max_target_countries} countries.`,
    }),
    low_data_mode: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.region !== "nigeria" && v.countries.filter((c) => c !== "NG").length === 0) {
      ctx.addIssue({ code: "custom", path: ["countries"], message: "Pick at least one country abroad." });
    }
  });

export async function saveSetup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse({
    career_stage: formData.get("career_stage"),
    region: formData.get("region"),
    countries: formData.getAll("countries"),
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

  const { career_stage, region, countries, low_data_mode } = parsed.data;
  // Nigeria first when the user applies at home; the first market is the default destination.
  const markets =
    region === "nigeria" ? ["NG"] : region === "both" ? ["NG", ...countries.filter((c) => c !== "NG")] : countries.filter((c) => c !== "NG");
  const target_markets = markets.slice(0, LIMITS.onboarding.max_target_countries);

  if (isPreviewMode()) redirect("/home");

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ career_stage, target_markets, low_data_mode, setup_completed_at: new Date().toISOString() })
    .eq("id", viewer.id);
  if (error) return { error: "We couldn't save your setup. Check your connection and try again." };

  await track("setup_completed", { career_stage, target_markets_count: target_markets.length }, viewer.id);
  redirect("/home");
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOut(): Promise<void> {
  if (!isPreviewMode()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
