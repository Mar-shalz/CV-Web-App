"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/env";
import { removeUserFiles } from "@/lib/account/files";
import { logAdminAction, requireAdmin } from "@/lib/admin/auth";
import { ADMIN_ROLES } from "@/lib/admin/permissions";
import { notify } from "@/lib/notifications/data";

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
  // Adding someone who was paused brings them straight back (no-op before the migration).
  await db.from("admin_members").update({ paused_at: null }).eq("user_id", user.id);
  await logAdminAction(staff, "add_member", "admin_members", user.id, { role: parsed.data.role });
  revalidatePath("/admin/team");
  return { ok: "Added. They'll be asked to set up two factor sign in." };
}

/** Team changes never touch your own access, and never leave the team without an owner. */
async function teamTarget(staffId: string, formData: FormData): Promise<{ id: string; role: string } | null> {
  const id = uuid.safeParse(formData.get("user_id"));
  if (!id.success || id.data === staffId) return null;
  const db = createAdminClient();
  const { data } = await db.from("admin_members").select("*").eq("user_id", id.data).maybeSingle();
  if (!data) return null;
  if (data.role === "owner") {
    const { data: owners } = await db.from("admin_members").select("*").eq("role", "owner").is("revoked_at", null);
    const active = (owners ?? []).filter((o) => !o.paused_at && o.user_id !== id.data);
    if (!active.length) return null;
  }
  return { id: id.data, role: data.role };
}

/** Pause: no back office access until reactivated. Their account and app use are untouched. */
export async function pauseMember(formData: FormData): Promise<void> {
  const staff = await requireAdmin("team");
  if (staff.preview) return;
  const target = await teamTarget(staff.id, formData);
  if (!target) return;
  const { error } = await createAdminClient().from("admin_members").update({ paused_at: new Date().toISOString() }).eq("user_id", target.id);
  if (!error) await logAdminAction(staff, "pause_member", "admin_members", target.id, { role: target.role });
  revalidatePath("/admin/team");
}

export async function reactivateMember(formData: FormData): Promise<void> {
  const staff = await requireAdmin("team");
  const id = uuid.safeParse(formData.get("user_id"));
  if (staff.preview || !id.success || id.data === staff.id) return;
  const db = createAdminClient();
  let { error } = await db.from("admin_members").update({ paused_at: null, revoked_at: null }).eq("user_id", id.data);
  // Before the pause migration runs there is no paused_at column.
  if (error) ({ error } = await db.from("admin_members").update({ revoked_at: null }).eq("user_id", id.data));
  if (!error) await logAdminAction(staff, "reactivate_member", "admin_members", id.data);
  revalidatePath("/admin/team");
}

/** Delete: off the team for good. Their app account stays; add them again any time. */
export async function deleteMember(formData: FormData): Promise<void> {
  const staff = await requireAdmin("team");
  if (staff.preview) return;
  const target = await teamTarget(staff.id, formData);
  if (!target) return;
  const { error } = await createAdminClient().from("admin_members").delete().eq("user_id", target.id);
  if (!error) await logAdminAction(staff, "delete_member", "admin_members", target.id, { role: target.role });
  revalidatePath("/admin/team");
}

const LINK = /^\/[A-Za-z0-9/_?=&.#-]*$/;
const messageSchema = z.object({
  to: z.enum(["everyone", "trial", "pass", "no_pass", "person"]),
  email: z.string().trim().toLowerCase().max(160).optional(),
  title: z.string().trim().min(3, "Add a short title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(3, "Add the message.").max(600, "Keep the message under 600 characters."),
  link: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || LINK.test(v), "Links must be a page in the app, starting with /, for example /pass."),
  days: z.coerce.number().int().min(1).max(90).optional(),
});

/**
 * Sends an update to the Updates panel: an announcement to everyone (or one group), or a
 * message to one person found by email. Logged without the message text.
 */
export async function sendUpdate(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const staff = await requireAdmin("messages");
  const parsed = messageSchema.safeParse({
    to: formData.get("to"),
    email: formData.get("email") || undefined,
    title: formData.get("title"),
    body: formData.get("body"),
    link: formData.get("link") || undefined,
    days: formData.get("days") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const m = parsed.data;
  if (staff.preview) return { ok: "Preview: nothing was sent." };
  const db = createAdminClient();

  if (m.to === "person") {
    if (!m.email) return { error: "Add the person's email." };
    const { data: user } = await db.from("users").select("id").eq("email", m.email).maybeSingle();
    if (!user) return { error: "No account uses that email." };
    const { error } = await db.from("notifications").insert({ user_id: user.id, kind: "message", title: m.title, body: m.body, link: m.link ?? null });
    if (error) return { error: "Couldn't send the message." };
    await logAdminAction(staff, "message_person", "notifications", user.id);
    revalidatePath("/admin/messages");
    return { ok: "Sent. It shows in their Updates panel." };
  }

  const ends = m.days ? new Date(Date.now() + m.days * 86_400_000).toISOString() : null;
  const { data, error } = await db.from("announcements").insert({ title: m.title, body: m.body, link: m.link ?? null, audience: m.to, ends_at: ends, created_by: staff.id }).select("id").single();
  if (error || !data) return { error: "Couldn't send the update." };
  await logAdminAction(staff, "announce", "announcements", data.id, { audience: m.to, days: m.days ?? null });
  revalidatePath("/admin/messages");
  return { ok: "Sent. It shows in the Updates panel now." };
}

/** Takes an announcement down straight away. */
export async function endAnnouncement(formData: FormData): Promise<void> {
  const staff = await requireAdmin("messages");
  const id = uuid.safeParse(formData.get("id"));
  if (staff.preview || !id.success) return;
  await createAdminClient().from("announcements").update({ ends_at: new Date().toISOString() }).eq("id", id.data);
  await logAdminAction(staff, "end_announcement", "announcements", id.data);
  revalidatePath("/admin/messages");
}

const freeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Enter their email address." })),
  days: z.enum(["30", "90", "365", "forever"]),
  note: z.string().trim().max(120).optional(),
});

/**
 * Free access for family and testers: everything a paid pass gives, at no cost. Matched on
 * the email they sign in with, so it works before they sign up. Owner and finance only.
 */
export async function grantFreeAccess(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const staff = await requireAdmin("payments");
  const parsed = freeSchema.safeParse({ email: formData.get("email"), days: formData.get("days"), note: formData.get("note") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (staff.preview) return { ok: "Preview: nothing changed." };
  const { email, days, note } = parsed.data;
  const ends = days === "forever" ? null : new Date(Date.now() + Number(days) * 86_400_000).toISOString();
  const db = createAdminClient();
  // One live grant per email: end the old one first.
  await db.from("free_access").update({ revoked_at: new Date().toISOString() }).eq("email", email).is("revoked_at", null);
  const { data, error } = await db.from("free_access").insert({ email, ends_at: ends, note: note ?? null, created_by: staff.id }).select("id").single();
  if (error || !data) return { error: "Couldn't save that. Run the latest database file first." };
  await logAdminAction(staff, "grant_free_access", "free_access", data.id, { days });
  const { data: user } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (user) {
    await notify(user.id, { kind: "pass", title: "You have free access", body: ends ? `Everything is open for you until ${new Date(ends).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Enjoy it.` : "Everything is open for you. Enjoy it.", link: "/home", dedupeKey: `free_access:${data.id}` }).catch(() => {});
  }
  revalidatePath("/admin/payments");
  return { ok: user ? "Done. They have full access now." : "Done. It switches on when they sign up with that email." };
}

export async function revokeFreeAccess(formData: FormData): Promise<void> {
  const staff = await requireAdmin("payments");
  const id = uuid.safeParse(formData.get("id"));
  if (staff.preview || !id.success) return;
  await createAdminClient().from("free_access").update({ revoked_at: new Date().toISOString() }).eq("id", id.data);
  await logAdminAction(staff, "revoke_free_access", "free_access", id.data);
  revalidatePath("/admin/payments");
}

// ---------------------------------------------------------------------------
// Account controls (owner only)
// ---------------------------------------------------------------------------

/** Signs staff out, back to the sign in page. */
export async function signOutAdmin(): Promise<void> {
  if (isPreviewMode()) redirect("/sign-in?signed_out=1");
  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => {});
  redirect("/sign-in?signed_out=1");
}

/** Team members can't be paused or deleted here: remove them from the team first. */
async function guardTarget(staffId: string, userId: string): Promise<string | null> {
  if (userId === staffId) return "You can't do this to your own account.";
  const { data } = await createAdminClient().from("admin_members").select("user_id").eq("user_id", userId).is("revoked_at", null).maybeSingle();
  return data ? "This person is on the team. Remove them in Team and access first." : null;
}

/**
 * Pauses an account: the app sends them to a "paused" page at once, and the sign in
 * service refuses new sessions. Nothing is deleted; Restore undoes it.
 */
export async function suspendUser(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const staff = await requireAdmin("users.manage");
  const id = uuid.safeParse(formData.get("user_id"));
  const reason = z.string().trim().max(200).safeParse(formData.get("reason") ?? "");
  if (!id.success || !reason.success) return { error: "Keep the reason under 200 characters." };
  if (staff.preview) return { ok: "Preview: nothing changed." };
  const blocked = await guardTarget(staff.id, id.data);
  if (blocked) return { error: blocked };
  const db = createAdminClient();
  const { error } = await db.from("users").update({ suspended_at: new Date().toISOString(), suspended_reason: reason.data || null }).eq("id", id.data);
  if (error) return { error: "Couldn't pause the account. Has the latest database update been run?" };
  await db.auth.admin.updateUserById(id.data, { ban_duration: "876000h" });
  await logAdminAction(staff, "suspend", "users", id.data, { with_reason: Boolean(reason.data) });
  revalidatePath(`/admin/users/${id.data}`);
  revalidatePath("/admin/users");
  return { ok: "Account paused." };
}

export async function restoreUser(formData: FormData): Promise<void> {
  const staff = await requireAdmin("users.manage");
  const id = uuid.safeParse(formData.get("user_id"));
  if (staff.preview || !id.success) return;
  const db = createAdminClient();
  await db.from("users").update({ suspended_at: null, suspended_reason: null }).eq("id", id.data);
  await db.auth.admin.updateUserById(id.data, { ban_duration: "none" });
  await logAdminAction(staff, "restore", "users", id.data);
  revalidatePath(`/admin/users/${id.data}`);
  revalidatePath("/admin/users");
}

/**
 * Deletes an account for good: files first, then the sign in record, which removes every
 * row we hold through the database cascade. The owner types the person's email to confirm.
 */
export async function deleteUserAccount(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const staff = await requireAdmin("users.manage");
  const id = uuid.safeParse(formData.get("user_id"));
  if (!id.success) return { error: "Unknown account." };
  if (staff.preview) return { ok: "Preview: nothing changed." };
  const blocked = await guardTarget(staff.id, id.data);
  if (blocked) return { error: blocked };
  const db = createAdminClient();
  const { data: user } = await db.from("users").select("email").eq("id", id.data).maybeSingle();
  if (!user) return { error: "This account no longer exists." };
  const typed = String(formData.get("confirm_email") ?? "").trim().toLowerCase();
  if (typed !== user.email.toLowerCase()) return { error: "Type the person's email exactly to confirm." };
  if (!(await removeUserFiles(db, id.data))) return { error: "Couldn't delete their files. Nothing else was removed. Try again." };
  const { error } = await db.auth.admin.deleteUser(id.data);
  if (error) return { error: "Couldn't delete the account. Their files are gone; try again to finish." };
  // No email in the log: the account id is enough, and the person is gone.
  await logAdminAction(staff, "delete_account", "users", id.data);
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}
