import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { accessState, canUse } from "@/lib/entitlements";
import { runTask } from "@/lib/ai";
import { lintCopy } from "@/lib/copy-lint";
import { getCvById } from "@/lib/cv/data";
import { track } from "@/lib/analytics/server";
import type { ApplicationView } from "@/lib/applications/data";
import type { InviteDetails } from "@/lib/applications/outcome";
import { cvLines, linkQuestions, fallbackQuestions, completeQuestions, answerContradictions, type ShortlistQuestion, type CvLine } from "./questions";
import { daysUntil } from "./logistics";
import { runResearch } from "@/lib/ai/research";

export type DrillAttempt = {
  questionId: string;
  answer: string;
  mode: "voice" | "text";
  matches: "yes" | "partly" | "no";
  issues: { type: string; detail: string }[];
  points: string[];
  didWell: string | null;
  at: string;
};

export type WebQuestion = { question: string; why: string; aboutEmployer: boolean; source: { url: string; title: string } };

export type ShortlistView = {
  id: string;
  invite: InviteDetails & { logisticsDone: number[] };
  questions: ShortlistQuestion[];
  attempts: DrillAttempt[];
  lines: CvLine[];
  webQuestions: WebQuestion[];
};

export type ShortlistAccess = "pass" | "trial" | "boost" | "locked";

const EMPTY_INVITE: ShortlistView["invite"] = { date: null, time: null, placeOrLink: null, format: "unknown", logisticsDone: [] };

/** Shortlist mode is part of the trial and the pass; without either, the interview boost unlocks it for one invite. */
export async function shortlistAccess(viewer: Viewer, applicationId: string): Promise<ShortlistAccess> {
  const state = accessState({ trialStartedAt: viewer.trial.startedAt, trialEndsAt: viewer.trial.endsAt, trialCvsUsed: viewer.trial.cvsUsed, activePass: viewer.activePass });
  if (state.kind === "pass") return "pass";
  if (canUse("shortlist", state)) return "trial";
  if (viewer.preview) return "locked";
  const supabase = await createClient();
  const { data } = await supabase.from("passes").select("id").eq("user_id", viewer.id).eq("type", "interview_boost").eq("status", "active").eq("application_id", applicationId).limit(1).maybeSingle();
  return data ? "boost" : "locked";
}

function demo(lines: CvLine[]): ShortlistView {
  const day = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  return { id: "demo-shortlist", invite: { date: day, time: "10:00", placeOrLink: "Plot 12, Adeola Odeku Street, Victoria Island, Lagos", format: "in_person", logisticsDone: [0] }, questions: fallbackQuestions(lines), attempts: [], lines, webQuestions: [] };
}

type Row = { id: string; invite_details: Partial<ShortlistView["invite"]> | null; questions: ShortlistQuestion[] | null; drill_attempts: DrillAttempt[] | null; web_questions?: WebQuestion[] | null };

export async function getShortlist(viewer: Viewer, app: ApplicationView): Promise<ShortlistView> {
  const cv = app.cvId ? await getCvById(viewer, app.cvId) : null;
  const lines = cv ? cvLines(cv.doc) : [];
  if (viewer.preview) return demo(lines);
  const supabase = await createClient();
  const { data } = await supabase.from("shortlist_sessions").select("*").eq("application_id", app.id).eq("user_id", viewer.id).maybeSingle();
  let row = data as Row | null;
  if (!row) {
    const { data: created } = await supabase.from("shortlist_sessions").insert({ application_id: app.id, user_id: viewer.id, invite_details: EMPTY_INVITE }).select("*").single();
    row = created as Row | null;
    if (row) await track("shortlist_opened", { days_until_interview: -1 }, viewer.id);
  }
  if (!row) throw new Error("Could not open Shortlist mode");
  return { id: row.id, invite: { ...EMPTY_INVITE, ...(row.invite_details ?? {}) }, questions: row.questions ?? [], attempts: row.drill_attempts ?? [], lines, webQuestions: row.web_questions ?? [] };
}

/** Invite details from a pasted message or typed by hand. One Shortlist session per application. */
export async function saveInvite(viewer: Viewer, applicationId: string, invite: InviteDetails): Promise<void> {
  if (viewer.preview) return;
  const supabase = await createClient();
  const { data } = await supabase.from("shortlist_sessions").select("id, invite_details").eq("application_id", applicationId).eq("user_id", viewer.id).maybeSingle();
  const merged = { ...EMPTY_INVITE, ...((data?.invite_details as object) ?? {}), ...invite };
  if (data) await supabase.from("shortlist_sessions").update({ invite_details: merged }).eq("id", data.id).eq("user_id", viewer.id);
  else await supabase.from("shortlist_sessions").insert({ application_id: applicationId, user_id: viewer.id, invite_details: merged });
  await track("shortlist_opened", { days_until_interview: daysUntil(invite.date) ?? -1 }, viewer.id);
}

export async function updateShortlist(viewer: Viewer, sessionId: string, patch: { invite_details?: object; questions?: ShortlistQuestion[]; drill_attempts?: DrillAttempt[]; web_questions?: WebQuestion[] }): Promise<void> {
  if (viewer.preview) return;
  const supabase = await createClient();
  await supabase.from("shortlist_sessions").update(patch).eq("id", sessionId).eq("user_id", viewer.id);
}

/** Likely questions from the job snapshot and the CV sent, each linked to a line in that CV. */
export async function generateQuestions(viewer: Viewer, app: ApplicationView, view: ShortlistView): Promise<ShortlistQuestion[]> {
  // Logged applications (CV made elsewhere) have no CV lines: standard questions still work.
  if (viewer.preview || !view.lines.length) {
    const questions = fallbackQuestions(view.lines);
    if (!viewer.preview) await updateShortlist(viewer, view.id, { questions });
    return questions;
  }
  const parsed = app.snapshot?.parsed;
  const res = await runTask(
    "shortlist_questions",
    {
      job: { title: app.title, employer: app.employer, level: parsed?.experience_level ?? undefined, requirements: (parsed?.requirements ?? []).map((r) => r.text).slice(0, 20), post: (app.snapshot?.rawText ?? "").slice(0, 8000) },
      bullets: view.lines.slice(0, 40).map((l) => ({ id: l.id, role: l.role, text: l.text })),
      format: view.invite.format,
    },
    { userId: viewer.id },
  );
  const linked = res.ok ? linkQuestions(res.data.questions, view.lines).filter((q) => !lintCopy(q.question).length) : [];
  // Opening first, then the model's questions, topped up to at least MIN_QUESTIONS.
  const questions = completeQuestions(linked, view.lines);
  await updateShortlist(viewer, view.id, { questions });
  return questions;
}

/** One drill answer: code checks numbers against the CV line, the model adds the rest. */
export async function drillAnswer(viewer: Viewer, view: ShortlistView, questionId: string, answer: string, mode: "voice" | "text"): Promise<DrillAttempt | { error: string }> {
  const q = view.questions.find((x) => x.id === questionId);
  if (!q) return { error: "We couldn't find that question. Refresh and try again." };
  const line = q.bulletId ? (view.lines.find((l) => l.id === q.bulletId) ?? null) : null;
  // General questions are checked against their strongest CV lines instead of one line.
  const context = line ? [line] : [...view.lines].sort((a, b) => Number(/\d/.test(b.text)) - Number(/\d/.test(a.text))).slice(0, 6);
  const contradictions = answerContradictions(answer, line);

  let attempt: DrillAttempt;
  if (viewer.preview) {
    attempt = {
      questionId,
      answer,
      mode,
      matches: contradictions.length ? "no" : "yes",
      issues: contradictions.map((detail) => ({ type: "contradicts_cv", detail })),
      points: line ? ["Set the scene in one line: where you were and what the job needed", "Say what you did, in your own words", `End with the result from your CV: "${line.text}"`] : ["Say who you are now in one line", "Give your strongest proof for this job, with a real number", "Say why this role, in about a minute in all"],
      didWell: "You answered the question they asked.",
      at: new Date().toISOString(),
    };
  } else {
    const res = await runTask(
      "drill_feedback",
      {
        question: q.question,
        answer,
        bullet: line
          ? { text: line.text, facts: [line.original, line.sourceQuote].filter((v): v is string => Boolean(v)) }
          : { text: "General question: no single CV line. Their strongest CV lines are in their notes.", facts: context.map((l) => l.text).slice(0, 8) },
      },
      { userId: viewer.id },
    );
    const modelIssues = res.ok ? res.data.issues : [];
    const points = res.ok ? res.data.stronger_points.filter((p) => !lintCopy(p).length) : ["Say where you were and what the job needed", "Say what you did", "End with the result exactly as it is on your CV"];
    const matches = contradictions.length ? "no" : res.ok ? res.data.matches_cv : "partly";
    attempt = {
      questionId,
      answer: answer.slice(0, 6000),
      mode,
      matches,
      issues: [...contradictions.map((detail) => ({ type: "contradicts_cv", detail })), ...modelIssues].slice(0, 6),
      points,
      didWell: res.ok ? res.data.did_well : null,
      at: new Date().toISOString(),
    };
  }
  await updateShortlist(viewer, view.id, { drill_attempts: [...view.attempts, attempt].slice(-60) });
  await track("drill_answered", { mode }, viewer.id);
  return attempt;
}

const SAMPLE_WEB: WebQuestion[] = [
  { question: "Tell us about a time you found an error in a set of figures. What did you do?", why: "Reported by past candidates for bank graduate programmes", aboutEmployer: false, source: { url: "https://example.com/graduate-interview-questions", title: "Graduate interview questions (sample)" } },
  { question: "Why do you want to start your career in banking rather than in an audit firm?", why: "Asked at assessment centres for finance trainee roles", aboutEmployer: false, source: { url: "https://example.com/assessment-centre-guide", title: "Assessment centre guide (sample)" } },
];

/**
 * Questions people report from real interviews for this employer or this kind of role,
 * found on the web, each with the page it came from. Uses the same two step research as
 * the scam check: search first, then a structuring step that can only cite real results.
 */
export async function findWebQuestions(viewer: Viewer, app: ApplicationView, view: ShortlistView): Promise<WebQuestion[]> {
  if (viewer.preview) return SAMPLE_WEB;
  const parsed = app.snapshot?.parsed;
  const country = parsed?.location?.country ?? "Nigeria";
  const brief = `Employer: ${app.employer}\nRole: ${app.title}\nCountry: ${country}\nLevel: ${parsed?.experience_level ?? "unknown"}\nInterview format: ${view.invite.format}`;
  const research = await runResearch({ name: "interview_search", model: "claude-sonnet-5-5", user: brief, maxSearches: 3, userId: viewer.id });
  if (!research.ok || !research.sources.length) return [];
  const res = await runTask("interview_research", { employer: app.employer, role: app.title, sources: research.sources, notes: research.notes }, { userId: viewer.id });
  if (!res.ok) return [];
  const found: WebQuestion[] = res.data.questions
    .map((q) => ({ q, src: research.sources[q.source_index - 1] }))
    .filter((x): x is { q: (typeof res.data.questions)[number]; src: { url: string; title: string } } => Boolean(x.src) && !lintCopy(x.q.question).length)
    .map(({ q, src }) => ({ question: q.question, why: q.why, aboutEmployer: q.about_employer, source: src }));
  await updateShortlist(viewer, view.id, { web_questions: found });
  return found;
}
