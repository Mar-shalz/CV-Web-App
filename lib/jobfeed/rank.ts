import type { FeedJob } from "./types";

// Which found jobs are worth a full fit check (D-205). Pure, so it is unit tested. Plain
// arithmetic on words: the fit check that decides the match percentage runs only on the
// few that come out on top, because it costs money.

export type Band = "entry" | "early" | "mid" | "senior";

/** Years of full time work, as a band: what level of job to look for. */
export function bandFor(workMonths: number): Band {
  return workMonths < 12 ? "entry" : workMonths < 36 ? "early" : workMonths < 96 ? "mid" : "senior";
}

const SENIOR = /\b(senior|sr|lead|principal|staff|head|director|vp|vice president|chief|manager|partner)\b/i;
const TOP = /\b(director|vp|vice president|chief|head of|partner)\b/i;
const JUNIOR = /\b(intern|internship|graduate|trainee|junior|entry level|apprentice|siwes|nysc)\b/i;

/** A job at a level the person could really be hired at. */
export function levelFits(title: string, band: Band): boolean {
  if (band === "entry" || band === "early") return !SENIOR.test(title);
  if (band === "mid") return !TOP.test(title) && !/\b(intern|internship|apprentice)\b/i.test(title);
  return !JUNIOR.test(title);
}

/** A role to search for, from a job title: no brackets, programme words or departments after a comma. */
export function cleanRole(title: string | null | undefined): string | null {
  if (!title) return null;
  const t = title
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(siwes|nysc|corps member|industrial training)\b/gi, " ")
    .replace(/\s*[|/–-]\s.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 3 && t.length <= 60 ? t : null;
}

/** Up to `max` roles: the jobs they've been going for first, then what they do now. */
export function rolesFrom(applied: (string | null)[], held: (string | null)[], max: number): string[] {
  const out: string[] = [];
  for (const t of [...applied, ...held]) {
    const r = cleanRole(t);
    if (r && !out.some((o) => o.toLowerCase() === r.toLowerCase())) out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** Posted within the window. A job with no date is kept: the sources only list open jobs. */
export function fresh(job: Pick<FeedJob, "postedAt">, maxAgeDays: number, now = Date.now()): boolean {
  if (!job.postedAt) return true;
  const t = Date.parse(job.postedAt);
  return Number.isNaN(t) || now - t <= maxAgeDays * 86_400_000;
}

/** Remote jobs open to where the person is looking, or to anywhere. */
export function placeFits(job: Pick<FeedJob, "countries" | "remote">, markets: string[]): boolean {
  if (!job.countries.length) return true;
  return job.countries.some((c) => markets.includes(c));
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(" ").filter((w) => w.length > 2));

/**
 * 0 to 100: half for how close the title is to one of their roles, half for how many of
 * their skills the post names (eight or more is full marks).
 */
export function prescore(job: Pick<FeedJob, "title" | "description">, roles: string[], skills: string[]): number {
  const title = words(job.title);
  const best = Math.max(0, ...roles.map((r) => {
    const rw = [...words(r)];
    return rw.length ? rw.filter((w) => title.has(w)).length / rw.length : 0;
  }));
  const text = ` ${`${job.title} ${job.description}`.toLowerCase().replace(/\s+/g, " ")} `;
  const hits = new Set(skills.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 1 && text.includes(` ${s}`))).size;
  return Math.round(50 * best + 50 * Math.min(1, hits / 8));
}
