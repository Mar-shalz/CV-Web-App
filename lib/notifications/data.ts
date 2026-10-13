import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/auth/viewer";
import { accessState } from "@/lib/entitlements";

export type InboxKind = "message" | "payment" | "pass" | "trial" | "application" | "system" | "announcement";
export type InboxItem = { id: string; kind: InboxKind; title: string; body: string | null; link: string | null; at: string; unread: boolean };
export type Inbox = { items: InboxItem[]; unread: number };

const HOUR = 3_600_000;

function previewInbox(): Inbox {
  const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();
  const items: InboxItem[] = [
    { id: "p1", kind: "trial", title: "Your free trial ends tomorrow", body: "You have 3 tailored CVs left. Your experience and applications stay free after the trial.", link: "/pass", at: ago(2), unread: true },
    { id: "p2", kind: "announcement", title: "Graduate programme season is here", body: "Big banks and the Big 4 open their graduate programmes this month. Check each job before you apply: we'll tell you if you qualify.", link: null, at: ago(26), unread: true },
    { id: "p3", kind: "payment", title: "Payment confirmed", body: "Interview boost, ₦1,500. Interview prep is open for Audit Associate.", link: "/applications/r1/shortlist", at: ago(80), unread: false },
  ];
  return { items, unread: items.filter((i) => i.unread).length };
}

/** Messages from the team, payment receipts and account reminders, newest first. */
export async function getInbox(viewer: Viewer): Promise<Inbox> {
  if (viewer.preview) return previewInbox();
  const supabase = await createClient();
  const [{ data: personal }, { data: live }, { data: reads }] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, link, created_at, read_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("announcements").select("id, title, body, link, audience, starts_at").order("starts_at", { ascending: false }).limit(10),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", viewer.id),
  ]);
  const access = accessState({ trialStartedAt: viewer.trial.startedAt, trialEndsAt: viewer.trial.endsAt, trialCvsUsed: viewer.trial.cvsUsed, activePass: viewer.activePass });
  const fits = (audience: string) =>
    audience === "everyone" || (audience === "pass" && access.kind === "pass") || (audience === "no_pass" && access.kind !== "pass") || (audience === "trial" && (access.kind === "trial" || access.kind === "trial_ready"));
  const read = new Set((reads ?? []).map((r) => r.announcement_id));

  const items: InboxItem[] = [
    ...(personal ?? []).map((n) => ({ id: n.id, kind: n.kind as InboxKind, title: n.title, body: n.body, link: n.link, at: n.created_at, unread: !n.read_at })),
    ...(live ?? []).filter((a) => fits(a.audience)).map((a) => ({ id: `a:${a.id}`, kind: "announcement" as const, title: a.title, body: a.body, link: a.link, at: a.starts_at, unread: !read.has(a.id) })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 30);
  return { items, unread: items.filter((i) => i.unread).length };
}

/** Opening the panel marks everything in it as read. */
export async function markInboxRead(viewer: Viewer, ids: string[]): Promise<void> {
  if (viewer.preview || !ids.length) return;
  const supabase = await createClient();
  const personal = ids.filter((i) => /^[0-9a-f-]{36}$/.test(i));
  const announcements = ids.filter((i) => i.startsWith("a:")).map((i) => i.slice(2)).filter((i) => /^[0-9a-f-]{36}$/.test(i));
  if (personal.length) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", viewer.id).in("id", personal).is("read_at", null);
  if (announcements.length) await supabase.from("announcement_reads").upsert(announcements.map((announcement_id) => ({ user_id: viewer.id, announcement_id })), { onConflict: "user_id,announcement_id", ignoreDuplicates: true });
}

/**
 * Writes one personal notification with the service role. A dedupe key makes repeats
 * (a retried webhook, a daily job running twice) a no op.
 */
export async function notify(userId: string, n: { kind: Exclude<InboxKind, "announcement">; title: string; body?: string | null; link?: string | null; dedupeKey?: string }): Promise<void> {
  const { error } = await createAdminClient()
    .from("notifications")
    .insert({ user_id: userId, kind: n.kind, title: n.title.slice(0, 120), body: n.body?.slice(0, 600) ?? null, link: n.link ?? null, dedupe_key: n.dedupeKey ?? null });
  // 23505 is the dedupe key doing its job.
  if (error && error.code !== "23505") throw error;
}
