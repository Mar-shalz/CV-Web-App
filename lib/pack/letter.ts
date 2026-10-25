// The cover letter (founder, round 25, D-186). When a job asks for one (Nigerian posts often
// say "send your CV and application letter"), the pack includes a formal letter as its own
// file. The model writes only the paragraphs, from the same fact locked proof as the email;
// code writes everything a model could get wrong: the person's details, the date, the
// heading, the greeting and the sign-off.

export type CoverLetter = {
  /** The person's name and contact lines, top of the letter. */
  sender: string[];
  date: string;
  recipient: string[];
  heading: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  name: string;
};

const ASKS = /\b(cover(?:ing)?\s+letter|application\s+letter|letter\s+of\s+(?:application|interest|motivation)|motivation(?:al)?\s+letter)\b/i;

/** Whether the post asks for a cover letter: in the documents it lists, or anywhere in its words. */
export function asksForLetter(requiredDocuments: string[], rawText: string | null): boolean {
  return requiredDocuments.some((d) => ASKS.test(d)) || ASKS.test(rawText ?? "");
}

const GREETING = /^(dear\b[^\n]*|to whom it may concern[^\n]*)$/i;
const CLOSING = /^(yours (?:faithfully|sincerely|truly)|sincerely|kind regards|best regards|regards|warm regards|respectfully)\b/i;

/** The model's paragraphs, without any greeting, sign-off or name it added, and no em dashes. */
export function cleanParagraphs(raw: string[], name: string): string[] {
  const out: string[] = [];
  for (const p of raw) {
    const text = p
      .replace(/\r\n?/g, "\n")
      .replace(/\s*—\s*/g, ", ")
      .split(/\n{2,}/)
      .map((s) => s.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    for (const t of text) {
      if (GREETING.test(t) || CLOSING.test(t) || t.toLowerCase() === name.toLowerCase().trim()) continue;
      out.push(t);
    }
  }
  return out.slice(0, 6);
}

/** "18 October 2026", or "October 18, 2026" for a US letter. */
export function letterDate(isoDay: string, us: boolean): string {
  const [y, m, d] = isoDay.split("-").map(Number) as [number, number, number];
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1] ?? "";
  return us ? `${month} ${d}, ${y}` : `${d} ${month} ${y}`;
}

export function buildLetter(input: {
  paragraphs: string[];
  name: string;
  phone: string | null;
  email: string | null;
  place: string | null;
  employer: string | null;
  role: string;
  today: string;
  format: string;
}): CoverLetter {
  // North American letters: month first dates and "Sincerely," (US, and Canada since D-198).
  const us = input.format === "us" || input.format === "ca";
  const nigerian = input.format.startsWith("ng");
  const employer = input.employer && !/^the employer$/i.test(input.employer) ? input.employer : null;
  return {
    sender: [input.place, input.phone, input.email].filter((l): l is string => Boolean(l && l.trim())),
    date: letterDate(input.today, us),
    recipient: ["The Hiring Manager", ...(employer ? [employer] : [])],
    // Nigerian letters carry the classic capitalised heading; UK and US ones a plain "Re:" line.
    heading: nigerian ? `APPLICATION FOR THE POSITION OF ${input.role.toUpperCase()}` : `Re: Application for the ${input.role} role`,
    salutation: "Dear Hiring Manager,",
    paragraphs: input.paragraphs,
    // British usage: a letter to an unnamed reader closes "Yours faithfully".
    closing: us ? "Sincerely," : "Yours faithfully,",
    name: input.name,
  };
}

/** The letter as plain text, for copying and for the Word file's reading order. */
export function letterText(l: CoverLetter): string {
  return [l.name, ...l.sender, "", l.date, "", ...l.recipient, "", l.salutation, "", l.heading, "", ...l.paragraphs.flatMap((p) => [p, ""]), l.closing, "", "", l.name].join("\n").trim();
}

/** When the model is unavailable: a short, plain letter from the same proof (D-186). */
export function templateParagraphs(role: string, employer: string | null, proof: string[]): string[] {
  const [summary, ...lines] = proof;
  return [
    `I am applying for the ${role} role${employer ? ` at ${employer}` : ""}.${summary ? ` ${summary}` : ""}`,
    ...(lines.length ? [lines.slice(0, 3).map((l) => l.replace(/[.\s]*$/, ".")).join(" ")] : []),
    "My CV is enclosed with this letter. I would welcome the chance to discuss how I can contribute to your team, and I am available for an interview at your convenience.",
  ];
}

/** The file name next to the CV's: "Tolu_Adebayo_Cover_Letter_Graduate_Trainee". */
export function letterFileBase(cvFileBase: string): string {
  return cvFileBase.replace(/_(CV|Resume)(_|$)/, "_Cover_Letter$2");
}
