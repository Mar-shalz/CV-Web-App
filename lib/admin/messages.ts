import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmail } from "./permissions";

export type MessageDraft = { id: string; audience: string; email: string | null; title: string; body: string; link: string | null; days: number | null; updatedAt: string };
export type SentMessage = {
  /** admin_messages id, or "a:<announcement id>" / "n:<notification id>" for messages sent before history was kept. */
  id: string;
  audience: string;
  to: string;
  title: string;
  body: string | null;
  link: string | null;
  sentAt: string;
  by: string | null;
  state: "showing" | "ended" | "delivered" | "read" | "recalled";
  until: string | null;
  canRecall: boolean;
};

type MsgRow = {
  id: string;
  created_by: string | null;
  audience: string;
  recipient_id: string | null;
  recipient_email: string | null;
  title: string;
  body: string;
  link: string | null;
  days: number | null;
  status: string;
  announcement_id: string | null;
  notification_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

/** True when the error is "table not there yet" (before the database update runs). */
export const missingTable = (e: { code?: string } | null | undefined) => Boolean(e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204"));

/**
 * The Messages page: drafts, and a history of every message sent to groups or to one
 * person (D-123). Older messages, sent before history was kept, come from the
 * announcements and the people's Updates panels, so nothing sent is missing.
 */
export async function messageHistory(fullEmails: boolean): Promise<{ drafts: MessageDraft[]; sent: SentMessage[]; historyReady: boolean }> {
  const db = createAdminClient();
  const now = Date.now();
  const [msgs, anns, notes] = await Promise.all([
    db.from("admin_messages").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("announcements").select("id, title, body, link, audience, starts_at, ends_at, created_by").order("starts_at", { ascending: false }).limit(60),
    db.from("notifications").select("id, user_id, title, body, link, created_at, read_at").eq("kind", "message").order("created_at", { ascending: false }).limit(100),
  ]);
  const historyReady = !missingTable(msgs.error);
  const rows = (msgs.data ?? []) as MsgRow[];
  const annById = new Map((anns.data ?? []).map((a) => [a.id as string, a]));
  const noteById = new Map((notes.data ?? []).map((n) => [n.id as string, n]));
  const usedAnn = new Set(rows.map((r) => r.announcement_id).filter(Boolean));
  const usedNote = new Set(rows.map((r) => r.notification_id).filter(Boolean));

  const people = [
    ...new Set([...rows.map((r) => r.created_by), ...rows.map((r) => r.recipient_id), ...(anns.data ?? []).map((a) => a.created_by), ...(notes.data ?? []).map((n) => n.user_id)].filter((v): v is string => Boolean(v))),
  ];
  const { data: users } = people.length ? await db.from("users").select("id, email, full_name").in("id", people) : { data: [] };
  const userById = new Map((users ?? []).map((u) => [u.id as string, u as { id: string; email: string; full_name: string | null }]));
  const who = (id: string | null) => (id ? (userById.get(id)?.full_name ?? userById.get(id)?.email ?? null) : null);
  const emailOf = (email: string | null | undefined) => (email ? (fullEmails ? email : maskEmail(email)) : "One person");

  const sent: SentMessage[] = [];
  for (const r of rows.filter((x) => x.status !== "draft")) {
    const ann = r.announcement_id ? annById.get(r.announcement_id) : undefined;
    const note = r.notification_id ? noteById.get(r.notification_id) : undefined;
    const live = ann ? !ann.ends_at || new Date(ann.ends_at).getTime() > now : false;
    const state: SentMessage["state"] = r.status === "recalled" ? "recalled" : r.audience === "person" ? (note?.read_at ? "read" : "delivered") : live ? "showing" : "ended";
    sent.push({
      id: r.id,
      audience: r.audience,
      to: r.audience === "person" ? emailOf(r.recipient_email ?? userById.get(r.recipient_id ?? "")?.email) : r.audience,
      title: r.title,
      body: r.body,
      link: r.link,
      sentAt: r.sent_at ?? r.created_at,
      by: who(r.created_by),
      state,
      until: ann?.ends_at ?? null,
      canRecall: state === "showing" || state === "delivered" || state === "read",
    });
  }
  for (const a of anns.data ?? []) {
    if (usedAnn.has(a.id)) continue;
    const live = !a.ends_at || new Date(a.ends_at).getTime() > now;
    sent.push({ id: `a:${a.id}`, audience: a.audience, to: a.audience, title: a.title, body: a.body ?? null, link: a.link ?? null, sentAt: a.starts_at, by: who(a.created_by), state: live ? "showing" : "ended", until: a.ends_at, canRecall: live });
  }
  for (const n of notes.data ?? []) {
    if (usedNote.has(n.id)) continue;
    sent.push({ id: `n:${n.id}`, audience: "person", to: emailOf(userById.get(n.user_id)?.email), title: n.title, body: n.body ?? null, link: n.link ?? null, sentAt: n.created_at, by: null, state: n.read_at ? "read" : "delivered", until: null, canRecall: true });
  }
  sent.sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  const drafts: MessageDraft[] = rows
    .filter((r) => r.status === "draft")
    .map((r) => ({ id: r.id, audience: r.audience, email: r.recipient_email, title: r.title, body: r.body, link: r.link, days: r.days, updatedAt: r.updated_at }));
  return { drafts, sent: sent.slice(0, 80), historyReady };
}

export async function getDraft(id: string): Promise<MessageDraft | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await createAdminClient().from("admin_messages").select("*").eq("id", id).eq("status", "draft").maybeSingle();
  const r = data as MsgRow | null;
  return r ? { id: r.id, audience: r.audience, email: r.recipient_email, title: r.title, body: r.body, link: r.link, days: r.days, updatedAt: r.updated_at } : null;
}
