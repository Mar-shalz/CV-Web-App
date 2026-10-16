import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "@/lib/auth/viewer";
import type { ExtUser } from "./auth";

/**
 * The same Viewer the app builds from its session cookie, built for the browser extension
 * from its key (D-178): trial, pass and free access included, so the extension follows the
 * same entitlements. Every query filters by the person's id (or their sign in email for
 * free access).
 */
export async function extViewer(db: SupabaseClient, user: ExtUser): Promise<Viewer> {
  const now = new Date().toISOString();
  const [{ data: row }, { data: usage }, { data: passes }, { data: free }] = await Promise.all([
    db.from("users").select("*").eq("id", user.id).maybeSingle(),
    db.from("usage_counters").select("trial_started_at, trial_ends_at, trial_cvs_used").eq("user_id", user.id).maybeSingle(),
    db.from("passes").select("type, ends_at").eq("user_id", user.id).eq("status", "active").neq("type", "interview_boost").gt("ends_at", now).order("ends_at", { ascending: false }).limit(1),
    db.from("free_access").select("ends_at").ilike("email", user.email).is("revoked_at", null).limit(1).maybeSingle(),
  ]);
  const u = (row ?? {}) as { career_stage?: string | null; target_markets?: string[] | null; low_data_mode?: boolean; suspended_at?: string | null };
  const freeLive = free && (!free.ends_at || new Date(free.ends_at) > new Date());
  return {
    id: user.id,
    email: user.email,
    fullName: user.name,
    careerStage: u.career_stage ?? null,
    targetMarkets: u.target_markets ?? user.targetMarkets,
    lowDataMode: Boolean(u.low_data_mode),
    consentDone: true,
    setupDone: true,
    trial: { startedAt: usage?.trial_started_at ?? null, endsAt: usage?.trial_ends_at ?? null, cvsUsed: usage?.trial_cvs_used ?? 0 },
    activePass: passes?.[0] ? { type: passes[0].type, endsAt: passes[0].ends_at } : freeLive ? { type: "free_access", endsAt: free?.ends_at ?? "2099-12-31T00:00:00.000Z" } : null,
    suspended: Boolean(u.suspended_at),
    preview: false,
  };
}
