import type { CvDoc } from "@/lib/cv/types";
import { lockLine, type LockSource } from "@/lib/rules/fact-lock";

export type CvLine = { id: string; role: string; text: string; original: string; sourceQuote: string | null };
export type ShortlistQuestion = { id: string; question: string; why: string; bulletId: string; bulletText: string; kind: "defend_cv" | "job_fit" | "situational" | "technical" };

/** Every bullet of the CV that was actually sent, with the person's own words behind it. */
export function cvLines(doc: CvDoc): CvLine[] {
  return doc.sections.flatMap((s) =>
    s.kind === "roles"
      ? s.roles.flatMap((r) => r.bullets.map((b) => ({ id: b.id, role: [r.title, r.organisation].filter(Boolean).join(", "), text: b.text, original: b.original, sourceQuote: b.sourceQuote })))
      : [],
  );
}

/**
 * Keeps only questions that link to a line in the CV sent (Slice 8 "done when": every
 * question links to a bullet). Duplicates go too.
 */
export function linkQuestions(raw: { question: string; why: string; bullet_id: string; kind: ShortlistQuestion["kind"] }[], lines: CvLine[]): ShortlistQuestion[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const out: ShortlistQuestion[] = [];
  for (const q of raw) {
    const line = byId.get(q.bullet_id);
    const key = q.question.trim().toLowerCase();
    if (!line || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `q${out.length + 1}`, question: q.question.trim(), why: q.why.trim(), bulletId: line.id, bulletText: line.text, kind: q.kind });
  }
  return out;
}

/** When the model is unavailable: one "defend this line" question per strongest line. */
export function fallbackQuestions(lines: CvLine[], max = 6): ShortlistQuestion[] {
  const withNumbers = [...lines].sort((a, b) => Number(/\d/.test(b.text)) - Number(/\d/.test(a.text)));
  return withNumbers.slice(0, max).map((l, i) => ({
    id: `q${i + 1}`,
    question: `Walk me through this line on your CV: "${l.text}"`,
    why: "Panels often pick a line from your CV and ask you to explain it.",
    bulletId: l.id,
    bulletText: l.text,
    kind: "defend_cv",
  }));
}

/**
 * Deterministic part of the drill check: a number or year in the answer that the CV line
 * and the person's own notes don't have. The model's reading is added on top.
 */
export function answerContradictions(answer: string, line: CvLine): string[] {
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
