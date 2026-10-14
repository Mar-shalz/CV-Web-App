import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { PRICES } from "@/lib/config";

export type PassUsage = { used: number; cap: number; left: number; startsAt: string };

/**
 * Tailored CVs used in the current job hunt pass, against what it includes plus any
 * top-ups bought during it (D-114). Null when there's no paid pass (trial, free access
 * and preview are counted elsewhere or not capped).
 */
export async function passCvUsage(viewer: Viewer): Promise<PassUsage | null> {
  if (viewer.preview) return { used: 6, cap: PRICES.products.job_hunt_30d.tailored_cvs, left: PRICES.products.job_hunt_30d.tailored_cvs - 6, startsAt: new Date(Date.now() - 6 * 86_400_000).toISOString() };
  if (viewer.activePass?.type !== "job_hunt_30d") return null;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: pass } = await supabase.from("passes").select("starts_at").eq("user_id", viewer.id).eq("type", "job_hunt_30d").eq("status", "active").lte("starts_at", now).gt("ends_at", now).order("starts_at", { ascending: false }).limit(1).maybeSingle();
  if (!pass?.starts_at) return null;
  const [{ count: used }, topups] = await Promise.all([
    supabase.from("cv_versions").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).gte("created_at", pass.starts_at),
    // Fails harmlessly before the migration adds the cv_topup type.
    supabase.from("passes").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).eq("type", "cv_topup").eq("status", "active").gte("created_at", pass.starts_at),
  ]);
  const cap = PRICES.products.job_hunt_30d.tailored_cvs + (topups.error ? 0 : (topups.count ?? 0)) * PRICES.products.cv_topup.adds_cvs;
  const u = used ?? 0;
  return { used: u, cap, left: Math.max(0, cap - u), startsAt: pass.starts_at };
}
