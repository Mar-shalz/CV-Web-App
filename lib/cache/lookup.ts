import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";

// Our own record of what we've already looked up (founder round 33, D-200): web search
// results and the AI's reading of them, shared by everyone, so the same question is paid
// for once. Only public things go in: searches about employers, job titles and the
// contacts in job posts, never anything about the person using the app. Server only (the
// table is closed to app users). Without the table, or in preview, nothing is cached.

export type LookupKind = "search" | "legitimacy_read";

const enabled = () => isSupabaseConfigured() && !isPreviewMode() && Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

export const lookupKey = (kind: LookupKind, parts: unknown): string => createHash("sha256").update(`${kind}\u0000${JSON.stringify(parts)}`).digest("hex");

/** A saved answer no older than `maxAgeDays`, or null. Counts the reuse, for the back office. */
export async function readLookup<T>(key: string, maxAgeDays: number): Promise<T | null> {
  if (!enabled() || maxAgeDays <= 0) return null;
  try {
    const db = createAdminClient();
    const since = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();
    const { data, error } = await db.from("lookup_cache").select("value, hits").eq("key", key).gt("created_at", since).maybeSingle();
    if (error || !data) return null;
    await db.from("lookup_cache").update({ hits: (Number(data.hits) || 0) + 1, last_hit_at: new Date().toISOString() }).eq("key", key);
    return data.value as T;
  } catch {
    return null;
  }
}

/** Saves an answer. A failed save changes nothing: the answer was still given. */
export async function writeLookup(kind: LookupKind, key: string, value: unknown, label: string): Promise<void> {
  if (!enabled()) return;
  try {
    await createAdminClient()
      .from("lookup_cache")
      .upsert({ key, kind, label: label.slice(0, 300), value, created_at: new Date().toISOString(), hits: 0 }, { onConflict: "key" });
  } catch {
    // Nothing to do: the next look up asks again.
  }
}
