"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction, requireAdmin } from "@/lib/admin/auth";
import { ADMIN_ROLES } from "@/lib/admin/permissions";

export type AdminActionState = { ok?: string; error?: string } | undefined;

const uuid = z.uuid();

/** Marks a pass refunded after the money went back through the Paystack dashboard (refunds are by hand in the MVP). */
export async function markRefunded(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const staff = await requireAdmin("payments.refund");
  const id = uuid.safeParse(formData.get("pass_id"));
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm the refund went through in Paystack." };
  if (staff.preview) return { ok: "Preview: nothing changed." };
  if (!id.success) return { error: "Unknown payment." };
  const db = createAdminClient();
  const { error } = await db.from("passes").update({ status: "refunded", ends_at: new Date().toISOString() }).eq("id", id.data).in("status", ["active", "pending"]);
  if (error) return { error: "Couldn't update the payment." };
  await logAdminAction(staff, "refund", "passes", id.data);
  revalidatePath("/admin/payments");
  return { ok: "Marked as refunded." };
}

export async function resolveReport(formData: FormData): Promise<void> {
  const staff = await requireAdmin("reviews.resolve");
  const id = uuid.safeParse(formData.get("report_id"));
  const outcome = z.enum(["resolved", "dismissed"]).safeParse(formData.get("outcome"));
  if (staff.preview || !id.success || !outcome.success) return;
  const db = createAdminClient();
  await db.from("truth_reports").update({ status: outcome.data, resolved_at: new Date().toISOString(), resolved_by: staff.id }).eq("id", id.data);
  await logAdminAction(staff, outcome.data === "resolved" ? "resolve" : "dismiss", "truth_reports", id.data);
  revalidatePath("/admin/reviews");
}

export async function publishRuleSet(formData: FormData): Promise<void> {
  const staff = await requireAdmin("rules.publish");
  const version = z.string().min(1).max(80).safeParse(formData.get("version"));
  const table = z.enum(["rule_sets", "country_profiles"]).safeParse(formData.get("table"));
  if (staff.preview || !version.success || !table.success) return;
  const db = createAdminClient();
  // Only a reviewed version can be published.
  await db.from(table.data).update({ published_at: new Date().toISOString() }).eq("version", version.data).not("reviewed_at", "is", null);
  await logAdminAction(staff, "publish", table.data, version.data);
  revalidatePath("/admin/rules");
}

const memberSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), role: z.enum(ADMIN_ROLES) });

export async function addMember(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const staff = await requireAdmin("team");
  const parsed = memberSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: "Enter their email and pick a role." };
  if (staff.preview) return { ok: "Preview: nothing changed." };
  const db = createAdminClient();
  const { data: user } = await db.from("users").select("id").eq("email", parsed.data.email).maybeSingle();
  // The person must already have an account; they then set up two factor sign in on first visit.
  if (!user) return { error: "No account uses that email. Ask them to sign up first." };
  const { error } = await db.from("admin_members").upsert({ user_id: user.id, role: parsed.data.role, added_by: staff.id, revoked_at: null });
  if (error) return { error: "Couldn't add them." };
  await logAdminAction(staff, "add_member", "admin_members", user.id, { role: parsed.data.role });
  revalidatePath("/admin/team");
  return { ok: "Added. They'll be asked to set up two factor sign in." };
}

export async function revokeMember(formData: FormData): Promise<void> {
  const staff = await requireAdmin("team");
  const id = uuid.safeParse(formData.get("user_id"));
  if (staff.preview || !id.success || id.data === staff.id) return;
  const db = createAdminClient();
  await db.from("admin_members").update({ revoked_at: new Date().toISOString() }).eq("user_id", id.data);
  await logAdminAction(staff, "revoke_member", "admin_members", id.data);
  revalidatePath("/admin/team");
}
