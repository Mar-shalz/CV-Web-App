"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteSensitive, type SensitiveField } from "@/lib/sensitive";
import { LEGAL } from "@/lib/config";
import { track } from "@/lib/analytics/server";

export type SettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const link = (max: number, message: string) => opt(max).refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), message);
const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Add your full name as it should appear on your CV.").max(120),
  phone_code: z.string().regex(/^\+\d{1,4}$/).default("+234"),
  phone: opt(20).refine((v) => !v || /^[0-9 ]{6,16}$/.test(v), "Use digits only, for example 803 000 0000."),
  contact_email: opt(160).refine((v) => !v || z.email().safeParse(v).success, "Check the email address."),
  city: opt(80),
  state: opt(80),
  linkedin_url: opt(200).refine((v) => !v || /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?$/.test(v), "Paste your full LinkedIn profile link."),
  portfolio_url: link(200, "Paste the full link, starting with https://"),
  website_url: link(200, "Paste the full link, starting with https://"),
});

/** Personal details as they appear at the top of every CV. */
export async function saveProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const keys = ["full_name", "phone_code", "phone", "contact_email", "city", "state", "linkedin_url", "portfolio_url", "website_url"];
  const parsed = profileSchema.safeParse(Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  if (viewer.preview) return { ok: true };
  const { phone_code, phone, ...rest } = parsed.data;
  // Stored with its dialling code, without the local leading 0: "+234 8030000000".
  const full = phone ? `${phone_code} ${phone.replace(/\s+/g, "").replace(/^0/, "")}` : null;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ ...rest, phone: full }).eq("user_id", viewer.id);
  if (error) return { error: "We couldn't save your details. Try again." };
  revalidatePath("/settings");
  return { ok: true };
}

/** Data saver: no animations, system fonts, lighter pages. */
export async function setLowData(on: boolean): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;
  if (viewer.preview) return true;
  const supabase = await createClient();
  // Only low_data_mode: people may update a few user columns, not updated_at (a trigger sets it).
  const { error } = await supabase.from("users").update({ low_data_mode: Boolean(on) }).eq("id", viewer.id);
  if (error) return false;
  revalidatePath("/", "layout");
  return true;
}

const FIELDS = ["date_of_birth", "gender", "state_of_origin", "nysc_status", "nysc_start", "nysc_end"] as const;

/** Deletes one sensitive detail, or all of them. We ask again only if a job needs it. */
export async function removeSensitive(field: string): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false };
  const which = field === "all" ? [...FIELDS] : FIELDS.filter((f) => f === field);
  if (!which.length) return { ok: false };
  if (viewer.preview) return { ok: true };
  const ok = await deleteSensitive(viewer.id, which as SensitiveField[]);
  revalidatePath("/settings/sensitive");
  return { ok };
}

/** Optional consents can be given or withdrawn any time. Each change is a new row. */
export async function setConsent(type: "marketing" | "question_bank" | "sensitive_details", granted: boolean): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false };
  if (!["marketing", "question_bank", "sensitive_details"].includes(type)) return { ok: false };
  if (viewer.preview) return { ok: true };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const version = LEGAL.consents[type]?.version ?? `${type}-v0.1`;
  const { error } = await supabase.from("consents").insert({ user_id: viewer.id, type, version, granted_at: granted ? now : null, withdrawn_at: granted ? null : now });
  if (!error && type === "sensitive_details" && !granted) await deleteSensitive(viewer.id, [...FIELDS]);
  if (!error && type === "question_bank" && !granted) {
    // Withdrawing also takes your past debrief questions out of the bank.
    await supabase.from("debriefs").update({ share_consent: false }).eq("user_id", viewer.id);
  }
  await track("consent_updated", { type, granted }, viewer.id);
  revalidatePath("/settings/consents");
  return { ok: !error };
}

/**
 * Closes the account for good: files in storage first (they aren't covered by the
 * database cascade), then the sign in record, which removes every row we hold.
 */
export async function deleteAccount(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { fieldErrors: { confirm: "Type DELETE to confirm." } };
  if (viewer.preview) redirect("/?account=deleted");

  const supabase = await createClient();
  for (const bucket of ["job-uploads", "cv-exports"]) {
    for (let round = 0; round < 20; round++) {
      const { data: files } = await supabase.storage.from(bucket).list(viewer.id, { limit: 100 });
      if (!files?.length) break;
      const { error } = await supabase.storage.from(bucket).remove(files.map((f) => `${viewer.id}/${f.name}`));
      if (error) return { error: "We couldn't delete your files. Try again, or contact us and we'll do it for you." };
    }
  }
  const { error } = await createAdminClient().auth.admin.deleteUser(viewer.id);
  if (error) return { error: "We couldn't close your account just now. Try again, or contact us and we'll do it for you." };
  await supabase.auth.signOut().catch(() => {});
  redirect("/sign-in?signed_out=1&deleted=1");
}
