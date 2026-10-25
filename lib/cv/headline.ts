import type { CvDoc } from "./types";

// The headline under the name (founder, round 32, D-198). Career offices and recruiters in
// Nigeria, the UK, the US and Canada put the name and contact details at the top, then at
// most one line of professional identity: a job title held, or the field of work, with a
// strength or two. The course studied, the degree and its class belong in Education. The
// model is told this; code makes sure, since a headline is the first line a recruiter reads.

/** Words that describe study, not work. A headline part with any of them is dropped. */
const STUDY =
  /\b(graduate|undergraduate|student|alumn(?:us|a|i)|b\.?\s?sc|bsc|b\.?\s?a|b\.?\s?ed|b\.?\s?eng|beng|b\.?\s?tech|btech|llb|mbbs|hnd|ond|nce|m\.?\s?sc|msc|m\.?\s?a|mba|ph\.?\s?d|degree|diploma|bachelor'?s?|master'?s?|first class|second class|third class|upper credit|lower credit|2:1|2:2|cgpa|gpa|university|polytechnic|college|faculty)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * The headline with every part about study taken out, and the job's own title taken out
 * unless the person has held it (a headline never claims a title). Empty when nothing is
 * left: the name and contact details then lead, as career offices advise.
 */
export function cleanHeadline(line: string | null | undefined, opts: { jobTitle?: string | null; held?: (string | null)[] } = {}): string {
  if (!line) return "";
  const held = new Set((opts.held ?? []).filter((t): t is string => Boolean(t)).map(norm));
  const target = opts.jobTitle ? norm(opts.jobTitle) : "";
  const parts = line
    .split(/\s*[|·•,]\s*|\s+[-–]\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1)
    .filter((p) => !STUDY.test(p))
    .filter((p) => !(target && norm(p) === target && !held.has(target)));
  const seen = new Set<string>();
  const kept = parts.filter((p) => !seen.has(norm(p)) && (seen.add(norm(p)), true));
  return kept.join(" | ").slice(0, 120).trim();
}

/** An unsent CV made before D-198 shows and downloads without the course in its headline. */
export function withCleanHeadline(doc: CvDoc): CvDoc {
  const titleLine = cleanHeadline(doc.titleLine);
  if (titleLine === doc.titleLine) return doc;
  const lower = titleLine.toLowerCase();
  return { ...doc, titleLine, titleFlags: (doc.titleFlags ?? []).filter((f) => lower.includes(String(f.token).toLowerCase())) };
}
