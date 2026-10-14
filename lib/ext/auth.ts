import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPreviewMode } from "@/lib/env";

// The browser extension signs in with its own key (D-144), not the app's cookies: the
// person taps "Connect" in the app while signed in, the app makes a random key, and the
// extension keeps it. The server keeps only a hash. Every request names the person
// through the key, and every query below is filtered by that person's id.

export type ExtUser = { id: string; email: string; name: string | null; targetMarkets: string[]; preview: boolean };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createExtensionToken(userId: string, label: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await createAdminClient().from("extension_tokens").insert({ user_id: userId, token_hash: hash(token), label: label?.slice(0, 80) ?? null });
  if (error) throw new Error("token");
  return token;
}

export async function revokeExtensionTokens(userId: string, token?: string): Promise<void> {
  let q = createAdminClient().from("extension_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null);
  if (token) q = q.eq("token_hash", hash(token));
  await q;
}

export function bearer(request: NextRequest): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer ([A-Za-z0-9_-]{40,60})$/);
  return m?.[1] ?? null;
}

/** The person behind an extension request, or null (bad, expired, revoked key, or a paused account). */
export async function extUser(request: NextRequest): Promise<ExtUser | null> {
  if (isPreviewMode()) return { id: "preview", email: "tolu.adebayo@gmail.com", name: "Tolu Adebayo", targetMarkets: ["NG"], preview: true };
  const token = bearer(request);
  if (!token) return null;
  const db = createAdminClient();
  const { data: row } = await db.from("extension_tokens").select("id, user_id, expires_at, revoked_at").eq("token_hash", hash(token)).maybeSingle();
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  const [{ data: user }, { data: profile }] = await Promise.all([db.from("users").select("*").eq("id", row.user_id).maybeSingle(), db.from("profiles").select("full_name").eq("user_id", row.user_id).maybeSingle()]);
  const u = user as { id: string; email: string; target_markets?: string[]; suspended_at?: string | null } | null;
  if (!u || u.suspended_at) return null;
  after(async () => {
    await db.from("extension_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  });
  return { id: u.id, email: u.email, name: (profile?.full_name as string | null) ?? null, targetMarkets: u.target_markets ?? [], preview: false };
}

const LIMITS = { ext_capture: 30, ext_check: 30, ext_save: 60 } as const;

/** Per person, per hour, like the app's limits (lib/rate-limit.ts), counted with the service role. */
export async function extAllow(userId: string, bucket: keyof typeof LIMITS): Promise<boolean> {
  if (isPreviewMode()) return true;
  const db = createAdminClient();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db.from("rate_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("bucket", bucket).gt("at", since);
  if ((count ?? 0) >= LIMITS[bucket]) return false;
  await db.from("rate_events").insert({ user_id: userId, bucket });
  return true;
}
