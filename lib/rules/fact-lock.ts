import { lintCopy } from "@/lib/copy-lint";
import type { Metric, Ownership } from "@/lib/vault/schema";

// The fact lock (Build pack section 6). Deterministic code that runs after tailor_cv and
// before the user sees anything. It never blocks a download: it drops lines with no
// valid source and flags lines with facts it can't trace.

export type LockSource = {
  id: string;
  text: string;
  sourceQuote: string | null;
  metrics: Metric[];
  ownership: Ownership;
  skills: string[];
  role: { kind: string; organisation: string | null; title: string | null; location: string | null; start: string | null; end: string | null; grade: string | null };
};

export type FlagType = "number" | "approximate" | "employer" | "title" | "date" | "qualification" | "ownership" | "phrase";
export type Flag = { type: FlagType; token: string; message: string };
export type LockBullet = { id: string; text: string; source_item_ids: string[] };
export type LockResult = { kept: (LockBullet & { flags: Flag[] })[]; dropped: string[]; flagCount: number };

const MESSAGES: Record<Exclude<FlagType, "ownership">, string> = {
  number: "This line has a number you did not give us. Add the real figure or remove it before you download.",
  approximate: "Your notes say this number is rough. Keep “about” in front of it, or add the exact figure.",
  employer: "This line names an employer or place you did not give us. Add the real detail or remove it before you download.",
  title: "This line has a job title you did not give us. Add the real title or remove it before you download.",
  date: "This line has a date you did not give us. Add the real date or remove it before you download.",
  qualification: "This line has a qualification you did not give us. Add the real one or remove it before you download.",
  phrase: "This line uses words recruiters read as AI. Say it in plainer words.",
};

// Terms every Nigerian CV may use without a source. Kept short on purpose.
const COMMON = new Set(
  ["i", "cv", "nysc", "siwes", "ppa", "cds", "nigeria", "nigerian", "english", "o", "level"].concat(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"],
  ),
);
const QUALIFICATION = /^(bsc|b\.sc|ba|beng|btech|llb|hnd|ond|msc|m\.sc|mba|phd|ican|acca|cibn|coren|cipm|cfa|aca|fca|acca|cima|nim|pmp|first|second|third|upper|lower|class|cgpa|gpa|distinction|credit)$/i;
const TITLE = /^(manager|officer|assistant|intern|analyst|director|engineer|accountant|supervisor|coordinator|head|executive|associate|trainee|representative|consultant|administrator|specialist|teller|clerk|lead)$/i;
const OWNERSHIP = /\b(led|managed|headed|owned|directed|founded|launched)\b/i;
const APPROX_BEFORE = /\b(about|around|approximately|roughly|nearly|over|more than|up to|almost|some)\s*$/i;
const NUMBER = /(₦|NGN\s?|N(?=\d))?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?(?:k|m|million|thousand)\b|\s?%|\s?percent\b|\+)?/gi;

const norm = (w: string) =>
  w
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/'s$/, "")
    .replace(/[^a-z0-9.&-]/g, "")
    .replace(/\.$/, "");

function scale(n: number, suffix: string | undefined): number {
  const s = (suffix ?? "").trim().toLowerCase();
  if (s === "k" || s === "thousand") return n * 1_000;
  if (s === "m" || s === "million") return n * 1_000_000;
  return n;
}

function numbersIn(text: string): { value: number; isYear: boolean; token: string; index: number; plus: boolean }[] {
  const out: { value: number; isYear: boolean; token: string; index: number; plus: boolean }[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const [whole, currency, digits, suffix] = m;
    if (!digits) continue;
    const raw = Number(digits.replace(/,/g, ""));
    const isYear = !currency && !suffix && /^(19|20)\d{2}$/.test(digits);
    out.push({ value: scale(raw, suffix && suffix.trim() !== "+" ? suffix : undefined), isYear, token: whole.trim(), index: m.index ?? 0, plus: (suffix ?? "").trim() === "+" });
  }
  return out;
}

function corpus(sources: LockSource[]) {
  const texts = sources.flatMap((s) => [s.text, s.sourceQuote ?? "", s.skills.join(" "), s.role.organisation ?? "", s.role.title ?? "", s.role.location ?? "", s.role.grade ?? ""]);
  const joined = texts.join(" \n ");
  const words = new Set<string>();
  for (const w of joined.split(/[\s,;:()/]+/)) {
    const n = norm(w);
    if (n) {
      words.add(n);
      words.add(n.replace(/s$/, ""));
    }
  }
  const numbers = new Set<number>();
  const years = new Set<number>();
  for (const n of numbersIn(joined)) (n.isYear ? years : numbers).add(n.value);
  for (const s of sources) {
    for (const m of s.metrics) numbers.add(m.value);
    for (const d of [s.role.start, s.role.end]) if (d) years.add(Number(d.slice(0, 4)));
  }
  return { words, numbers, years };
}

/** Flags for one line against the items it cites. Empty means every locked token traced. */
export function lockLine(text: string, sources: LockSource[]): Flag[] {
  const flags: Flag[] = [];
  const add = (type: FlagType, token: string) => {
    if (flags.some((f) => f.type === type && f.token === token)) return;
    const message =
      type === "ownership"
        ? sources.some((s) => s.ownership === "helped")
          ? "This line says you led this. Your notes say you helped."
          : "This line says you led this. Your notes don't say you were in charge."
        : MESSAGES[type];
    flags.push({ type, token, message });
  };
  const c = corpus(sources);

  // Numbers, money, percentages and years.
  for (const n of numbersIn(text)) {
    if (n.isYear) {
      if (!c.years.has(n.value)) add("date", n.token);
      continue;
    }
    if (!c.numbers.has(n.value)) {
      add("number", n.token);
      continue;
    }
    const approx = sources.some((s) => s.metrics.some((m) => m.approximate && m.value === n.value));
    if (approx && !n.plus && !APPROX_BEFORE.test(text.slice(Math.max(0, n.index - 24), n.index))) add("approximate", n.token);
  }

  // Proper nouns: organisations, places, titles, qualifications. Sentence starts are skipped.
  const tokens = text.split(/\s+/);
  tokens.forEach((raw, i) => {
    const word = raw.replace(/^[^A-Za-z0-9₦]+|[^A-Za-z0-9.&]+$/g, "").replace(/\.$/, "");
    if (!word || !/^[A-Z]/.test(word)) return;
    const prev = tokens[i - 1];
    const sentenceStart = i === 0 || /[.!?:]["”)]?$/.test(prev ?? "");
    const n = norm(word);
    if (!n || COMMON.has(n) || /^\d/.test(n)) return;
    if (sentenceStart && !/^[A-Z0-9]{2,}$/.test(word)) return;
    if (c.words.has(n) || c.words.has(n.replace(/s$/, ""))) return;
    add(QUALIFICATION.test(n) ? "qualification" : TITLE.test(n) ? "title" : "employer", word);
  });

  // Ownership verbs need an item marked led.
  const verb = OWNERSHIP.exec(text);
  if (verb && !sources.some((s) => s.ownership === "led")) add("ownership", verb[0]);

  // Banned phrases and em dashes.
  for (const issue of lintCopy(text)) add("phrase", issue.match);
  return flags;
}

/** Rule 1 (valid source ids) and rules 2 to 6 over every bullet. */
export function factLock(bullets: LockBullet[], vault: Map<string, LockSource>): LockResult {
  const kept: LockResult["kept"] = [];
  const dropped: string[] = [];
  let flagCount = 0;
  for (const b of bullets) {
    const sources = b.source_item_ids.map((id) => vault.get(id)).filter((s): s is LockSource => Boolean(s));
    if (!sources.length) {
      dropped.push(b.id);
      continue;
    }
    const flags = lockLine(b.text, sources);
    flagCount += flags.length;
    kept.push({ ...b, flags });
  }
  return { kept, dropped, flagCount };
}
