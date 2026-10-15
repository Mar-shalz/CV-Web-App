import type { CvDoc } from "@/lib/cv/types";
import { lockLine, type LockSource } from "@/lib/rules/fact-lock";
import BANK from "@/config/lists/interview_questions.json";

export type CvLine = { id: string; role: string; text: string; original: string; sourceQuote: string | null };
export type QuestionKind = "intro" | "defend_cv" | "job_fit" | "situational" | "technical" | "standard";
/** bulletId is null for general questions ("Tell me about yourself", industry standards). */
export type ShortlistQuestion = { id: string; question: string; why: string; bulletId: string | null; bulletText: string | null; kind: QuestionKind };

export const MIN_QUESTIONS = 10;

/** Always the first question (D-109). */
export const OPENING: ShortlistQuestion = { id: "q0", question: BANK.opening.question, why: BANK.opening.why, bulletId: null, bulletText: null, kind: "intro" };
/** Always the last (founder round 20): panels close with it. */
const CLOSING = { question: BANK.closing.question, why: BANK.closing.why };


/** Every bullet of the CV that was actually sent, with the person's own words behind it. */
export function cvLines(doc: CvDoc): CvLine[] {
  return doc.sections.flatMap((s) =>
    s.kind === "roles"
      ? s.roles.flatMap((r) => r.bullets.map((b) => ({ id: b.id, role: [r.title, r.organisation].filter(Boolean).join(", "), text: b.text, original: b.original, sourceQuote: b.sourceQuote })))
      : [],
  );
}

const isOpening = (q: string) => /^(please )?(tell (me|us) (a little )?about yourself|introduce yourself)/i.test(q.trim());

/**
 * "Defend your CV" questions must link to a real line in the CV sent; other questions may
 * link to the line to draw on, or to none. "Tell me about yourself" is dropped (it is
 * always first) and so are duplicates.
 */
export function linkQuestions(raw: { question: string; why: string; bullet_id: string | null; kind: Exclude<QuestionKind, "intro"> }[], lines: CvLine[]): ShortlistQuestion[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const out: ShortlistQuestion[] = [];
  for (const q of raw) {
    const line = q.bullet_id ? byId.get(q.bullet_id) : undefined;
    const key = q.question.trim().toLowerCase();
    if (seen.has(key) || isOpening(q.question)) continue;
    if (q.kind === "defend_cv" && !line) continue;
    seen.add(key);
    out.push({ id: `q${out.length + 1}`, question: q.question.trim(), why: q.why.trim(), bulletId: line?.id ?? null, bulletText: line?.text ?? null, kind: q.kind });
  }
  return out;
}

/**
 * The full list: the opening question, then the model's questions, topped up to at least
 * MIN_QUESTIONS with "defend this line" questions and standard ones from config.
 */
export function completeQuestions(linked: ShortlistQuestion[], lines: CvLine[]): ShortlistQuestion[] {
  const out = [...linked];
  const asked = new Set(out.map((q) => q.question.toLowerCase()));
  const strongest = [...lines].sort((a, b) => Number(/\d/.test(b.text)) - Number(/\d/.test(a.text)));
  const defended = new Set(out.filter((q) => q.kind === "defend_cv").map((q) => q.bulletId));
  for (const l of strongest) {
    if (out.length >= MIN_QUESTIONS - 1 - 4 || out.filter((q) => q.kind === "defend_cv").length >= 5) break;
    if (defended.has(l.id)) continue;
    out.push({ id: "", question: `Walk me through this line on your CV: "${l.text}"`, why: "Panels often pick a line from your CV and ask you to explain it.", bulletId: l.id, bulletText: l.text, kind: "defend_cv" });
  }
  for (const s of BANK.standard) {
    if (out.length >= MIN_QUESTIONS - 1) break;
    if (asked.has(s.question.toLowerCase())) continue;
    out.push({ id: "", question: s.question, why: s.why, bulletId: null, bulletText: null, kind: "standard" });
  }
  const body = out.filter((q) => q.question.trim().toLowerCase() !== CLOSING.question.toLowerCase());
  const closing: ShortlistQuestion = { id: "", question: CLOSING.question, why: CLOSING.why, bulletId: null, bulletText: null, kind: "job_fit" };
  return [OPENING, ...[...body, closing].map((q, i) => ({ ...q, id: `q${i + 1}` }))];
}

/** When the model is unavailable: the opening, defend-your-CV lines, then standard questions. */
export function fallbackQuestions(lines: CvLine[]): ShortlistQuestion[] {
  return completeQuestions([], lines);
}

/**
 * Deterministic part of the drill check: a number or year in the answer that the CV line
 * and the person's own notes don't have. The model's reading is added on top.
 */
export function answerContradictions(answer: string, line: CvLine | null): string[] {
  if (!line) return [];
  const source: LockSource = {
    id: line.id,
    text: `${line.text}\n${line.original}`,
    sourceQuote: line.sourceQuote,
    metrics: [],
    ownership: /\bled\b|\bmanaged\b|\bheaded\b/i.test(line.text) ? "led" : "did",
    skills: [],
    role: { kind: "job", organisation: null, title: null, location: null, start: null, end: null, grade: null },
  };
  return lockLine(answer, [source])
    .filter((f) => f.type === "number" || f.type === "date")
    .map((f) => (f.type === "number" ? `You said ${f.token}. That number isn't on your CV or in your notes. If they ask, you'll need to back it up.` : `You said ${f.token}. That date isn't on your CV.`));
}
