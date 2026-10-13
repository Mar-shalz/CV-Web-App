import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, type AdminRole, type Permission } from "./permissions";

export type Staff = { id: string; email: string; name: string | null; role: AdminRole; mfa: boolean; preview: boolean };

/**
 * The signed in staff member, or null. Non staff never learn the back office
 * exists: every guard below answers with a plain 404.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (viewer.preview) return { id: "preview", email: viewer.email, name: viewer.fullName, role: "owner", mfa: true, preview: true };

  const admin = createAdminClient();
  // "*" so a new column (paused_at) never locks the team out before its migration runs.
  const { data: member } = await admin.from("admin_members").select("*").eq("user_id", viewer.id).maybeSingle();
  if (!member || member.revoked_at || member.paused_at) return null;

  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { id: viewer.id, email: viewer.email, name: viewer.fullName, role: member.role as AdminRole, mfa: aal?.currentLevel === "aal2", preview: false };
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
