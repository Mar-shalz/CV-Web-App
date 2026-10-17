import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";

// Problems the team must hear about, shown on the back office overview (D-181). Kinds are
// fixed; details are short codes, never personal data.
export type OpsKind = "gmail_attach_failed";

export async function reportOps(kind: OpsKind, detail: Record<string, string | number | null>): Promise<void> {
  console.error(`[ops] ${kind}`, detail);
  if (isPreviewMode() || !isSupabaseConfigured()) return;
  const clean = Object.fromEntries(Object.entries(detail).map(([k, v]) => [k.slice(0, 30), typeof v === "string" ? v.slice(0, 120) : v]));
  await createAdminClient().from("ops_events").insert({ kind, detail: clean });
}

export type OpsSummary = { kind: OpsKind; count: number; last: string | null; reasons: { reason: string; count: number }[] };

/** The last 7 days of one kind, for the back office. Empty until the table exists. */
export async function opsSummary(kind: OpsKind): Promise<OpsSummary> {
  const empty: OpsSummary = { kind, count: 0, last: null, reasons: [] };
  if (isPreviewMode() || !isSupabaseConfigured()) return { ...empty, count: 2, last: new Date().toISOString(), reasons: [{ reason: "compose_not_found", count: 2 }] };
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await createAdminClient().from("ops_events").select("at, detail").eq("kind", kind).gte("at", since).order("at", { ascending: false }).limit(1000);
  if (error || !data) return empty;
  const by = new Map<string, number>();
  for (const r of data) {
    const reason = String((r.detail as { reason?: string })?.reason ?? "unknown");
    by.set(reason, (by.get(reason) ?? 0) + 1);
  }
  return { kind, count: data.length, last: data[0]?.at ?? null, reasons: [...by.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count) };
}
