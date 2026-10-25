import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import type { ParsedJob } from "@/lib/jobs/schema";
import type { ApplicationStatus } from "@/lib/rules/status-flow";
import { DEMO_PACK, DEMO_PARSED } from "@/lib/demo/job";
import type { CoverLetter } from "@/lib/pack/letter";
import { isSentVia, type SentVia } from "./sent-via";

export type PackView = {
  id: string;
  channel: "email" | "form" | "portal";
  toEmail: string | null;
  subject: string;
  body: string;
  attachmentNames: string[];
  checklist: { item: string; required: boolean }[];
  formFields: { label: string; hint: string }[];
  portalSteps: string[];
  applyUrl: string | null;
  /** When the job asks for one, or the person added one (D-186). */
  coverLetter: CoverLetter | null;
};

export type TimelineEvent = { from: ApplicationStatus | null; to: ApplicationStatus; source: string; at: string; evidence: string | null };

export type ApplicationView = {
  id: string;
  jobId: string;
  cvId: string | null;
  status: ApplicationStatus;
  statusVerified: boolean;
  sentAt: string | null;
  createdAt: string;
  nextCheckInAt: string | null;
  title: string;
  employer: string;
  snapshot: { parsed: ParsedJob; rawText: string | null; sourceUrl: string | null; imagePath: string | null; capturedAt: string } | null;
  pack: PackView | null;
  timeline: TimelineEvent[];
  /** Applications logged with a CV made elsewhere: the file they sent. */
  externalCv: { name: string } | null;
  /** How they sent it, when they said (D-199). */
  sentVia: SentVia | null;
};

type Row = {
  id: string;
  job_id: string;
  cv_version_id: string | null;
  status: ApplicationStatus;
  status_verified: boolean;
  sent_at: string | null;
  created_at: string;
  next_check_in_at: string | null;
  job_snapshot: ApplicationView["snapshot"] | null;
  jobs: { parsed: ParsedJob } | null;
  external_cv_path?: string | null;
  external_cv_name?: string | null;
  sent_via?: string | null;
  application_packs: { id: string; channel: PackView["channel"]; to_email: string | null; subject: string | null; body: string | null; attachment_names: string[]; checklist: PackView["checklist"]; form_fields: PackView["formFields"] | null; portal_steps: string[]; apply_url: string | null; cover_letter?: CoverLetter | null } | null;
};

// "*" so new columns (external CV) never break reads before their migration runs.
// The pack too, so its cover letter (round 25) reads before and after that update.
const SELECT = "*, jobs(parsed), application_packs(*)";

function toView(r: Row, timeline: TimelineEvent[] = []): ApplicationView {
  const parsed = r.job_snapshot?.parsed ?? r.jobs?.parsed ?? null;
  const p = r.application_packs;
  return {
    id: r.id,
    jobId: r.job_id,
    cvId: r.cv_version_id,
    status: r.status,
    statusVerified: r.status_verified,
    sentAt: r.sent_at,
    createdAt: r.created_at,
    nextCheckInAt: r.next_check_in_at,
    title: parsed?.title ?? "Untitled role",
    employer: parsed?.employer_name ?? "Employer not named",
    snapshot: r.job_snapshot,
    pack: p
      ? { id: p.id, channel: p.channel, toEmail: p.to_email, subject: p.subject ?? "", body: p.body ?? "", attachmentNames: p.attachment_names ?? [], checklist: p.checklist ?? [], formFields: p.form_fields ?? [], portalSteps: p.portal_steps ?? [], applyUrl: p.apply_url, coverLetter: readLetter(p.cover_letter) }
      : null,
    timeline,
    externalCv: r.external_cv_path ? { name: r.external_cv_name ?? "Your CV" } : null,
    sentVia: isSentVia(r.sent_via) ? r.sent_via : null,
  };
}

function readLetter(v: unknown): CoverLetter | null {
  const l = v as CoverLetter | null | undefined;
  return l && Array.isArray(l.paragraphs) && l.paragraphs.length && typeof l.name === "string" ? l : null;
}

const DEMO_APP: ApplicationView = {
  id: "demo-app",
  jobId: "demo",
  cvId: "demo-cv",
  status: "sent",
  statusVerified: false,
  sentAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
  createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  nextCheckInAt: new Date().toISOString(),
  title: DEMO_PARSED.title ?? "",
  employer: DEMO_PARSED.employer_name ?? "",
  snapshot: { parsed: DEMO_PARSED, rawText: "Graduate Trainee, Finance. Northbridge Bank is recruiting graduates... (sample)", sourceUrl: null, imagePath: null, capturedAt: new Date(Date.now() - 9 * 86_400_000).toISOString() },
  pack: { id: "demo-pack", channel: "email", toEmail: DEMO_PACK.to, subject: DEMO_PACK.subject, body: DEMO_PACK.body, attachmentNames: [DEMO_PACK.attachment, DEMO_PACK.letterFile], checklist: DEMO_PACK.checklist.map((c) => ({ item: c.item, required: true })), formFields: [], portalSteps: [], applyUrl: null, coverLetter: DEMO_PACK.letter },
  externalCv: null,
  sentVia: null,
  timeline: [
    { from: null, to: "draft", source: "tap", at: new Date(Date.now() - 9 * 86_400_000).toISOString(), evidence: null },
    { from: "draft", to: "packed", source: "tap", at: new Date(Date.now() - 9 * 86_400_000).toISOString(), evidence: null },
    { from: "packed", to: "sent", source: "tap", at: new Date(Date.now() - 8 * 86_400_000).toISOString(), evidence: null },
  ],
};

// Preview list mirrors the home sample so every row opens a detail screen.
const PREVIEW_ROWS: { id: string; title: string; employer: string; status: ApplicationStatus; daysAgo: number | null; channel: PackView["channel"] }[] = [
  { id: "r1", title: "Audit Associate", employer: "Adeyemi & Co. Chartered Accountants", status: "interview", daysAgo: 12, channel: "portal" },
  { id: "s1", title: DEMO_PARSED.title ?? "Graduate Trainee", employer: DEMO_PARSED.employer_name ?? "Northbridge Bank", status: "sent", daysAgo: 8, channel: "email" },
  { id: "s2", title: "Accounts Officer", employer: "Lekki Foods Manufacturing", status: "sent", daysAgo: 7, channel: "email" },
  { id: "r4", title: "Sales Representative", employer: "Seed company (name not given)", status: "packed", daysAgo: null, channel: "email" },
  { id: "r5", title: "Facility Officer", employer: "Recruiter client (name not given)", status: "no_response", daysAgo: 34, channel: "form" },
];

function previewApp(id: string): ApplicationView | null {
  if (id === "demo-app") return DEMO_APP;
  const row = PREVIEW_ROWS.find((r) => r.id === id);
  if (!row) return null;
  const sentAt = row.daysAgo === null ? null : new Date(Date.now() - row.daysAgo * 86_400_000).toISOString();
  const extra: TimelineEvent[] =
    row.status === "interview" ? [{ from: "sent", to: "interview", source: "pasted_sms", at: new Date(Date.now() - 2 * 86_400_000).toISOString(), evidence: "You have been shortlisted for an interview on Thursday at 10am." }] : row.status === "no_response" ? [{ from: "sent", to: "no_response", source: "auto_30d", at: new Date(Date.now() - 4 * 86_400_000).toISOString(), evidence: null }] : [];
  return {
    ...DEMO_APP,
    id: row.id,
    title: row.title,
    employer: row.employer,
    status: row.status,
    sentAt,
    pack: DEMO_APP.pack ? { ...DEMO_APP.pack, channel: row.channel } : null,
    timeline: row.status === "packed" ? DEMO_APP.timeline.slice(0, 2) : [...DEMO_APP.timeline, ...extra],
  };
}

export async function getApplication(viewer: Viewer, id: string): Promise<ApplicationView | null> {
  if (viewer.preview) return previewApp(id);
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const [{ data }, { data: events }] = await Promise.all([
    supabase.from("applications").select(SELECT).eq("id", id).eq("user_id", viewer.id).maybeSingle(),
    supabase.from("outcome_events").select("from_status, to_status, source, created_at, evidence_text").eq("application_id", id).eq("user_id", viewer.id).order("created_at"),
  ]);
  if (!data) return null;
  return toView(data as unknown as Row, (events ?? []).map((e) => ({ from: e.from_status, to: e.to_status, source: e.source, at: e.created_at, evidence: e.evidence_text })));
}

export async function getApplicationForJob(viewer: Viewer, jobId: string): Promise<ApplicationView | null> {
  if (viewer.preview) return jobId === "demo" ? { ...DEMO_APP, status: "packed", sentAt: null } : null;
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select(SELECT).eq("job_id", jobId).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? toView(data as unknown as Row) : null;
}

export async function listApplications(viewer: Viewer): Promise<ApplicationView[]> {
  if (viewer.preview) return PREVIEW_ROWS.map((r) => previewApp(r.id)).filter((a): a is ApplicationView => Boolean(a));
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select(SELECT).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as unknown as Row[]).map((r) => toView(r));
}
