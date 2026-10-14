import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { isPreviewMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, type AdminRole, type Permission } from "./permissions";

export type Staff = { id: string; email: string; name: string | null; role: AdminRole; mfa: boolean; preview: boolean };

/**
 * The signed in staff member, or null. Non staff never learn the back office
 * exists: every guard below answers with a plain 404.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (isPreviewMode()) return { id: "preview", email: "tolu.adebayo@gmail.com", name: "Tolu Adebayo", role: "owner", mfa: true, preview: true };
  const user = await getAdminUser();
  if (!user) return null;

  const admin = createAdminClient();
  // "*" so a new column (paused_at) never locks the team out before its migration runs.
  const [{ data: member }, { data: profile }] = await Promise.all([admin.from("admin_members").select("*").eq("user_id", user.id).maybeSingle(), admin.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()]);
  if (!member || member.revoked_at || member.paused_at) return null;

  const supabase = await createAdminSessionClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const name = (profile?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined) ?? null;
  return { id: user.id, email: user.email ?? "", name, role: member.role as AdminRole, mfa: aal?.currentLevel === "aal2", preview: false };
});

/** Whoever is signed in to the back office (its own session, D-136), staff or not. */
export const getAdminUser = cache(async () => {
  if (isPreviewMode()) return null;
  const supabase = await createAdminSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Staff member with two factor sign in done and the permission asked for. */
export async function requireAdmin(permission: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) notFound();
  if (!staff.mfa) redirect("/admin/mfa");
  if (!can(staff.role, permission)) notFound();
  return staff;
}

/**
 * Every view of personal data and every change is written to the audit log.
 * `detail` must never hold personal data: ids, counts and filters only.
 */
export async function logAdminAction(staff: Staff, action: string, entity: string, entityId?: string | null, detail: Record<string, unknown> = {}) {
  if (staff.preview) return;
  const admin = createAdminClient();
  await admin.from("audit_log").insert({ actor: staff.id, actor_role: staff.role, action, entity, entity_id: entityId ?? null, detail });
}
