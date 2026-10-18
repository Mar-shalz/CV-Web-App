import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import type { ApplicationView } from "@/lib/applications/data";
import { runTask } from "@/lib/ai";
import { lintCopy } from "@/lib/copy-lint";
import { LIMITS } from "@/lib/config";
import { track } from "@/lib/analytics/server";
import BANK from "@/config/lists/interview_questions.json";
import { OPENING, answerContradictions, type CvLine } from "./questions";
import { updateShortlist, type ShortlistView } from "./data";

// The mock interview (founder round 26, D-189): one question at a time, like the real
// thing. It opens with "Tell me about yourself"; after each answer the interviewer gives
// short feedback and asks the next question, often a follow up on what was just said;
// it closes with "Do you have any questions for us?" and a wrap up. Answers are checked
// against the CV that was sent, by code (numbers, dates) and by the model.

export type MockKind = "intro" | "follow_up" | "defend_cv" | "job_fit" | "situational" | "technical" | "standard" | "closing";
export type MockFeedback = { matches: "yes" | "partly" | "no"; didWell: string | null; improve: string[]; issues: string[] };
export type MockTurn = {
  id: string;
  question: string;
  why: string | null;
  kind: MockKind;
  bulletId: string | null;
  bulletText: string | null;
  answer: string | null;
  mode: "voice" | "text" | null;
  feedback: MockFeedback | null;
};
export type MockState = { turns: MockTurn[]; total: number; done: boolean; wrap: { strengths: string[]; workOn: string[] } | null; startedAt: string };

const total = () => Math.min(12, Math.max(3, LIMITS.shortlist.mock_questions));
const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const turn = (n: number, t: Omit<MockTurn, "id" | "answer" | "mode" | "feedback">): MockTurn => ({ id: `m${n}`, answer: null, mode: null, feedback: null, ...t });

export function newMock(): MockState {
  return { turns: [turn(1, { question: OPENING.question, why: OPENING.why, kind: "intro", bulletId: null, bulletText: null })], total: total(), done: false, wrap: null, startedAt: new Date().toISOString() };
}

/** Numbers and years in an answer that the CV doesn't have: its linked line, or the whole CV. */
export function cvChecks(answer: string, bulletId: string | null, lines: CvLine[]): string[] {
  const line = bulletId ? lines.find((l) => l.id === bulletId) : null;
  if (line) return answerContradictions(answer, line);
  if (!lines.length) return [];
  const all: CvLine = { id: "cv", role: "", text: lines.map((l) => l.text).join("\n"), original: lines.map((l) => l.original).join("\n"), sourceQuote: lines.map((l) => l.sourceQuote ?? "").join("\n") };
  return answerContradictions(answer, all);
}

/** When the model can't answer: the next likely question not yet asked, or a line to defend. */
export function fallbackNext(state: MockState, view: Pick<ShortlistView, "questions" | "lines">): Omit<MockTurn, "id" | "answer" | "mode" | "feedback"> {
  const asked = new Set(state.turns.map((t) => norm(t.question)));
  const closing = norm(BANK.closing.question);
  const likely = view.questions.find((q) => q.kind !== "intro" && !asked.has(norm(q.question)) && norm(q.question) !== closing);
  if (likely) return { question: likely.question, why: likely.why, kind: likely.kind === "intro" ? "standard" : likely.kind, bulletId: likely.bulletId, bulletText: likely.bulletText };
  const line = view.lines.find((l) => !state.turns.some((t) => t.bulletId === l.id));
  if (line) return { question: `Walk me through this line on your CV: "${line.text}"`, why: "Panels often pick a line from your CV and ask you to explain it.", kind: "defend_cv", bulletId: line.id, bulletText: line.text };
  const standard = BANK.standard.find((s) => !asked.has(norm(s.question)));
  return { question: standard?.question ?? "What would you want to achieve in your first three months in this role?", why: standard?.why ?? "Panels want to hear how you'd start.", kind: "standard", bulletId: null, bulletText: null };
}

/** The preview's interviewer (no AI): a follow up on the person's own words, then the likely questions. */
function previewTurn(state: MockState, answer: string, view: ShortlistView) {
  const words = answer.replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
  const follow = state.turns.length === 1 && words;
  return {
    feedback: { matches: "yes" as const, didWell: "You answered the question they asked, in your own words.", improve: ["Give one number from your CV to back it up", "End by linking it to what this job needs"], issues: [] },
    next: follow ? { question: `You said "${words}...". What was the hardest part of that, and how did you handle it?`, why: "Panels follow up on what you just said to see how deep your experience goes.", kind: "follow_up" as const, bulletId: null, bulletText: null } : fallbackNext(state, view),
    wrap: { strengths: ["You stayed on the question", "You used your own examples"], workOn: ["Give a number in every story answer", "Keep each answer to about a minute"] },
  };
}

/** One answer: feedback on it, then the next question, the closing question, or the wrap up. */
export async function answerMock(viewer: Viewer, app: ApplicationView, view: ShortlistView, answer: string, mode: "voice" | "text"): Promise<MockState | { error: string }> {
  const state = view.mock;
  const current = state?.turns.at(-1);
  if (!state || state.done || !current || current.answer) return { error: "Start the mock interview again." };
  const turns = state.turns.map((t) => (t === current ? { ...t, answer: answer.slice(0, 3000), mode } : t));
  const asked = turns.length;
  const final = asked >= state.total;
  const closingNext = asked === state.total - 1;

  let feedback: MockFeedback;
  let next: Omit<MockTurn, "id" | "answer" | "mode" | "feedback"> | null = null;
  let wrap: MockState["wrap"] = null;
  const checks = cvChecks(answer, current.bulletId, view.lines);

  if (viewer.preview) {
    const p = previewTurn(state, answer, view);
    feedback = { ...p.feedback, issues: checks };
    next = final ? null : p.next;
    wrap = final ? p.wrap : null;
  } else {
    const parsed = app.snapshot?.parsed;
    const res = await runTask(
      "mock_interview",
      {
        job: { title: app.title, employer: app.employer, level: parsed?.experience_level && parsed.experience_level !== "unknown" ? parsed.experience_level.replace(/_/g, " ") : null, requirements: (parsed?.requirements ?? []).map((r) => r.text).slice(0, 12), format: view.invite.format },
        cv_lines: view.lines.slice(0, 30).map((l) => ({ id: l.id, role: l.role, text: l.text })),
        turns: turns.slice(-12).map((t) => ({ question: t.question, kind: t.kind, bullet_id: t.bulletId, answer: (t.answer ?? "").slice(0, 3000) })),
        asked,
        total: state.total,
        final,
      },
      { userId: viewer.id },
    );
    const clean = (list: string[]) => list.filter((s) => s.trim() && !lintCopy(s).some((i) => i.kind === "phrase"));
    feedback = res.ok
      ? { matches: checks.length ? "no" : res.data.feedback.matches_cv, didWell: res.data.feedback.did_well, improve: clean(res.data.feedback.improve), issues: [...checks, ...clean(res.data.feedback.new_claims).map((c) => `Not on your CV: ${c}. If they ask, you'll need to back it up.`)].slice(0, 5) }
      : { matches: checks.length ? "no" : "partly", didWell: null, improve: ["Set the scene in one line", "Say what you did, in your own words", "End with the result from your CV"], issues: checks };
    if (final) wrap = res.ok && res.data.wrap_up ? { strengths: clean(res.data.wrap_up.strengths), workOn: clean(res.data.wrap_up.work_on) } : { strengths: [], workOn: ["Practise the likely questions below, out loud"] };
    else if (!closingNext) {
      const n = res.ok ? res.data.next : null;
      const line = n?.bullet_id ? view.lines.find((l) => l.id === n.bullet_id) : undefined;
      const repeat = n && turns.some((t) => norm(t.question) === norm(n.question));
      const special = n && [norm(OPENING.question), norm(BANK.closing.question)].includes(norm(n.question));
      next = n && !repeat && !special && !lintCopy(n.question).length && !(n.kind === "defend_cv" && !line) ? { question: n.question.trim(), why: n.why.trim() || null, kind: n.kind, bulletId: line?.id ?? null, bulletText: line?.text ?? null } : fallbackNext({ ...state, turns }, view);
    }
  }
  if (!final && closingNext) next = { question: BANK.closing.question, why: BANK.closing.why, kind: "closing", bulletId: null, bulletText: null };

  const answered = turns.map((t, i) => (i === turns.length - 1 ? { ...t, feedback } : t));
  const result: MockState = { ...state, turns: next ? [...answered, turn(answered.length + 1, next)] : answered, done: final, wrap };
  await updateShortlist(viewer, view.id, { mock_interview: result });
  await track("drill_answered", { mode }, viewer.id);
  return result;
}

/** Ends early: a wrap up from the answers so far. With none, the interview just closes. */
export async function endMock(viewer: Viewer, app: ApplicationView, view: ShortlistView): Promise<MockState | { error: string }> {
  const state = view.mock;
  if (!state) return { error: "There's no mock interview to end." };
  const answered = state.turns.filter((t) => t.answer);
  if (!answered.length) {
    await updateShortlist(viewer, view.id, { mock_interview: null });
    return { ...state, turns: [], done: true, wrap: null };
  }
  let wrap: MockState["wrap"] = { strengths: [], workOn: ["Finish a full mock interview when you have ten minutes"] };
  if (viewer.preview) wrap = { strengths: ["You used your own examples"], workOn: ["Give a number in every story answer"] };
  else {
    const parsed = app.snapshot?.parsed;
    const res = await runTask(
      "mock_interview",
      {
        job: { title: app.title, employer: app.employer, level: null, requirements: (parsed?.requirements ?? []).map((r) => r.text).slice(0, 12), format: view.invite.format },
        cv_lines: view.lines.slice(0, 30).map((l) => ({ id: l.id, role: l.role, text: l.text })),
        turns: answered.slice(-12).map((t) => ({ question: t.question, kind: t.kind, bullet_id: t.bulletId, answer: (t.answer ?? "").slice(0, 3000) })),
        asked: answered.length,
        total: answered.length,
        final: true,
      },
      { userId: viewer.id },
    );
    if (res.ok && res.data.wrap_up) wrap = { strengths: res.data.wrap_up.strengths.filter((s) => !lintCopy(s).length), workOn: res.data.wrap_up.work_on.filter((s) => !lintCopy(s).length) };
  }
  const result: MockState = { ...state, turns: answered, done: true, wrap };
  await updateShortlist(viewer, view.id, { mock_interview: result });
  return result;
}
