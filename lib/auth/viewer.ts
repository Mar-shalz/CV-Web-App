import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/env";
import { LEGAL } from "@/lib/config";

export type Viewer = {
  id: string;
  email: string;
  fullName: string | null;
  careerStage: string | null;
  targetMarkets: string[];
  lowDataMode: boolean;
  consentDone: boolean;
  setupDone: boolean;
  trial: { startedAt: string | null; endsAt: string | null; cvsUsed: number };
  activePass: { type: string; endsAt: string | null } | null;
  preview: boolean;
};

const PREVIEW_VIEWER: Viewer = {
  id: "preview",
  email: "tolu@example.test",
  fullName: "Tolu Adebayo",
  careerStage: "nysc",
  targetMarkets: ["NG", "GB"],
  lowDataMode: false,
  consentDone: true,
  setupDone: true,
  trial: { startedAt: null, endsAt: null, cvsUsed: 0 },
  activePass: null,
  preview: true,
};

/** The signed in user, read once per request. Null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (isPreviewMode()) return PREVIEW_VIEWER;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: row }, { data: profile }, { data: consents }, { data: usage }, { data: passes }] = await Promise.all([
    supabase.from("users").select("career_stage, target_markets, low_data_mode, age_confirmed_at, setup_completed_at").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("consents").select("type, version, granted_at, withdrawn_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("usage_counters").select("trial_started_at, trial_ends_at, trial_cvs_used").eq("user_id", user.id).maybeSingle(),
    supabase.from("passes").select("type, ends_at").eq("user_id", user.id).eq("status", "active").gt("ends_at", new Date().toISOString()).order("ends_at", { ascending: false }).limit(1),
  ]);

  // Latest record per type decides. Required consents must be granted at the current version.
  const latest = new Map<string, { version: string; granted_at: string | null; withdrawn_at: string | null }>();
  for (const c of consents ?? []) if (!latest.has(c.type)) latest.set(c.type, c);
  const hasCurrent = (type: "terms" | "privacy") => {
    const c = latest.get(type);
    return Boolean(c?.granted_at && !c.withdrawn_at && c.version === LEGAL.consents[type].version);
  };

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    careerStage: row?.career_stage ?? null,
    targetMarkets: row?.target_markets ?? [],
    lowDataMode: row?.low_data_mode ?? false,
    consentDone: Boolean(row?.age_confirmed_at) && hasCurrent("terms") && hasCurrent("privacy"),
    setupDone: Boolean(row?.setup_completed_at),
    trial: {
      startedAt: usage?.trial_started_at ?? null,
      endsAt: usage?.trial_ends_at ?? null,
      cvsUsed: usage?.trial_cvs_used ?? 0,
    },
    activePass: passes?.[0] ? { type: passes[0].type, endsAt: passes[0].ends_at } : null,
    preview: false,
  };
});

/** Where a signed in user should be right now in the onboarding sequence. */
export function nextOnboardingPath(v: Viewer): string {
  if (!v.consentDone) return "/onboarding/consent";
  if (!v.setupDone) return "/onboarding/setup";
  return "/home";
}

/** Use in app screens: signed in, consented and set up, or redirected. */
export async function requireReadyViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/sign-in");
  const next = nextOnboardingPath(v);
  if (next !== "/home") redirect(next);
  return v;
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/sign-in");
  return v;
}
