"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStaff, logAdminAction } from "@/lib/admin/auth";

export type MfaState = { error?: string; enroll?: { factorId: string; qr: string; secret: string } } | undefined;

/** Starts TOTP set up for staff who have no verified factor yet. */
export async function startEnrol(): Promise<MfaState> {
  const staff = await getStaff();
  if (!staff || staff.preview) redirect("/admin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Back office ${Date.now()}` });
  if (error || !data) return { error: "Couldn't start set up. Try again." };
  return { enroll: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

const codeSchema = z.object({ factorId: z.string().min(1), code: z.string().regex(/^\d{6}$/, "Enter the 6 digit code from your authenticator app.") });

export async function verifyMfa(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const staff = await getStaff();
  if (!staff || staff.preview) redirect("/admin");
  const parsed = codeSchema.safeParse({ factorId: formData.get("factor_id"), code: String(formData.get("code") ?? "").replace(/\s/g, "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return { error: "That code didn't work. Codes change every 30 seconds; try the newest one." };
  await logAdminAction({ ...staff, mfa: true }, "mfa_verified", "auth", null);
  redirect("/admin");
}
