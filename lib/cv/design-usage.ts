import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { CV_STYLES, type CvStyle } from "./styles";

// Data for "add more designs only when people ask" (D-148): downloads per design and
// requests for other designs. Anonymous: no user id, no CV.

export const DESIGN_REQUESTS = ["More colour", "Fits on one page", "Two columns", "With a photo", "More creative", "Something else"] as const;
export type DesignRequest = (typeof DESIGN_REQUESTS)[number];

export async function recordDesignEvent(kind: "download" | "request", value: { style?: CvStyle; reason?: DesignRequest }): Promise<void> {
  if (isPreviewMode() || !isSupabaseConfigured()) return;
  await createAdminClient()
    .from("cv_design_events")
    .insert({ kind, style: value.style ?? null, reason: value.reason ?? null })
    .then(
      () => {},
      () => {},
    );
}

export type DesignUsage = { downloads: Record<CvStyle, number>; requests: { reason: string; count: number }[]; ready: boolean };

export async function designUsage(days = 30): Promise<DesignUsage> {
  const empty: DesignUsage = { downloads: Object.fromEntries(CV_STYLES.map((s) => [s, 0])) as Record<CvStyle, number>, requests: [], ready: true };
  if (isPreviewMode() || !isSupabaseConfigured()) return { ...empty, downloads: { classic: 41, modern: 23, executive: 9 }, requests: [{ reason: "More colour", count: 4 }, { reason: "Fits on one page", count: 2 }] };
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await createAdminClient().from("cv_design_events").select("kind, style, reason").gte("at", since).limit(20000);
  if (error) return { ...empty, ready: false };
  const out = { ...empty, downloads: { ...empty.downloads } };
  const reasons = new Map<string, number>();
  for (const e of data ?? []) {
    if (e.kind === "download" && e.style && e.style in out.downloads) out.downloads[e.style as CvStyle]++;
    if (e.kind === "request" && e.reason) reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + 1);
  }
  out.requests = [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  return out;
}
