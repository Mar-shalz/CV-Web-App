import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import type { ApplicationStatus } from "@/lib/rules/status-flow";
import { LIMITS } from "@/lib/config";

export type HomeApplication = {
  id: string;
  title: string;
  employer: string;
  status: ApplicationStatus;
  sentAt: string | null;
  channel: "email" | "form" | "portal" | null;
};

export type HomeData = {
  stats: { sent: number; invites: number; awaiting: number; vaultConfirmed: number };
  checkIns: HomeApplication[];
  recent: HomeApplication[];
};

const INVITE_STATUSES: ApplicationStatus[] = ["interview", "second_interview", "offer", "accepted"];

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

// Sample data for local design review only (preview mode, never production).
const SAMPLE: HomeData = {
  stats: { sent: 6, invites: 1, awaiting: 4, vaultConfirmed: 8 },
  checkIns: [
    { id: "s1", title: "Graduate Trainee", employer: "Northbridge Bank", status: "sent", sentAt: daysAgo(8), channel: "portal" },
    { id: "s2", title: "Accounts Officer", employer: "Lekki Foods Manufacturing", status: "sent", sentAt: daysAgo(7), channel: "email" },
  ],
  recent: [
    { id: "r1", title: "Audit Associate", employer: "Adeyemi & Co. Chartered Accountants", status: "interview", sentAt: daysAgo(12), channel: "portal" },
    { id: "s1", title: "Graduate Trainee", employer: "Northbridge Bank", status: "sent", sentAt: daysAgo(8), channel: "portal" },
    { id: "s2", title: "Accounts Officer", employer: "Lekki Foods Manufacturing", status: "sent", sentAt: daysAgo(7), channel: "email" },
    { id: "r4", title: "Sales Representative", employer: "Seed company (name not given)", status: "packed", sentAt: null, channel: "email" },
    { id: "r5", title: "Facility Officer", employer: "Recruiter client (name not given)", status: "no_response", sentAt: daysAgo(34), channel: "form" },
  ],
};

const EMPTY: HomeData = { stats: { sent: 0, invites: 0, awaiting: 0, vaultConfirmed: 0 }, checkIns: [], recent: [] };

type Row = {
  id: string;
  status: ApplicationStatus;
  sent_at: string | null;
  next_check_in_at: string | null;
  job_snapshot: { title?: string; employer_name?: string } | null;
  application_packs: { channel: "email" | "form" | "portal" } | null;
};

function toHome(r: Row): HomeApplication {
  return {
    id: r.id,
    title: r.job_snapshot?.title ?? "Untitled role",
    employer: r.job_snapshot?.employer_name ?? "Employer not named",
    status: r.status,
    sentAt: r.sent_at,
    channel: r.application_packs?.channel ?? null,
  };
}

export async function getHomeData(viewer: Viewer, opts: { previewEmpty?: boolean } = {}): Promise<HomeData> {
  if (viewer.preview) return opts.previewEmpty ? EMPTY : SAMPLE;

  const supabase = await createClient();
  const [{ data: apps }, { count: vaultConfirmed }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, sent_at, next_check_in_at, job_snapshot, application_packs(channel)")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("vault_items").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).not("confirmed_at", "is", null),
  ]);

  const rows = (apps ?? []) as unknown as Row[];
  const now = Date.now();
  const sentRows = rows.filter((r) => r.sent_at);
  return {
    stats: {
      sent: sentRows.length,
      invites: rows.filter((r) => INVITE_STATUSES.includes(r.status)).length,
      awaiting: rows.filter((r) => r.status === "sent").length,
      vaultConfirmed: vaultConfirmed ?? 0,
    },
    checkIns: rows
      .filter((r) => r.status === "sent" && r.next_check_in_at && new Date(r.next_check_in_at).getTime() <= now)
      .slice(0, LIMITS.checkins.max_per_card)
      .map(toHome),
    recent: rows.slice(0, 5).map(toHome),
  };
}

/** Applications waiting for a check in answer: the number on the header bell. */
export async function getCheckInCount(viewer: Viewer): Promise<number> {
  if (viewer.preview) return SAMPLE.checkIns.length;
  const supabase = await createClient();
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("status", "sent")
    .lte("next_check_in_at", new Date().toISOString());
  return Math.min(count ?? 0, LIMITS.checkins.max_per_card);
}
