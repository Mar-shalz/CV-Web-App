// Reads web search results for the job check (D-156). Pure functions, no network, so
// they're unit tested: when the company started, whether the job is on the company's own
// careers page, and whether it's listed under the company's name on a known job site.
import sources from "@/config/lists/job_sources.json";
import { normaliseName, domainOf } from "./names";

export type Hit = { title: string; url: string; snippet: string };

const BOARDS = sources.job_boards as Record<string, string>;
const STOP = new Set(["and", "the", "for", "of", "in", "at", "to", "a", "an", "with", "on", "or"]);

/** Lower case words only, so "Product-Designer (UX)" reads "product designer ux". */
const plain = (s: string) => ` ${s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()} `;
const within = (h: string, d: string) => h === d || h.endsWith(`.${d}`);

/** Everything a search result says: its title, its snippet and the words in its address. */
function textOf(hit: Hit): string {
  let path = "";
  try {
    path = new URL(hit.url).pathname;
  } catch {
    // not a full address
  }
  return plain(`${hit.title} ${hit.snippet} ${path}`);
}

/** The company's name appears as a whole phrase ("helium health", not "helium" alone). */
export function nameIn(text: string, employer: string): boolean {
  const name = normaliseName(employer);
  return name.length >= 3 && plain(text).includes(` ${name} `);
}

/** Most of the job title's words appear (2 of 3, 3 of 4), so "Senior Product Designer (UX)" matches "Product Designer". */
export function titleIn(text: string, title: string): boolean {
  const key = plain(title.replace(/\(.*?\)/g, " ")).trim().split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  if (!key.length) return false;
  const t = plain(text);
  return key.filter((w) => t.includes(` ${w} `)).length / key.length >= 0.6;
}

const FOUNDED = /\b(?:founded|established|incorporated|launched|started operations|set up|commenced operations|began operations|in business since)\b[^.;!?]{0,120}?\b(1[6-9]\d{2}|20\d{2})\b/gi;

/**
 * When the company started, from what the search found: sentences such as "Cowrywise was
 * established in 2017" or "Founded 2017" on the company's LinkedIn page. A year only counts
 * when the company's name is in the same sentence or the page title, and the year most
 * pages agree on wins (the earliest on a tie). Null when nothing qualifies.
 */
export function foundedYear(hits: Hit[], employer: string, thisYear = new Date().getFullYear()): { year: number; url: string } | null {
  const votes = new Map<number, { n: number; url: string }>();
  for (const hit of hits) {
    const titleNamed = nameIn(hit.title, employer);
    const seen = new Set<number>();
    for (const sentence of `${hit.title}. ${hit.snippet}`.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      if (!titleNamed && !nameIn(sentence, employer)) continue;
      for (const m of sentence.matchAll(FOUNDED)) {
        const year = Number(m[1]);
        if (year > thisYear || seen.has(year)) continue;
        seen.add(year);
        const v = votes.get(year);
        votes.set(year, { n: (v?.n ?? 0) + 1, url: v?.url ?? hit.url });
      }
    }
  }
  const best = [...votes.entries()].sort((a, b) => b[1].n - a[1].n || a[0] - b[0])[0];
  return best ? { year: best[0], url: best[1].url } : null;
}

/** A result on the company's own site or hiring page (as `isOfficial` decides) that shows this job. */
export function careersHit(hits: Hit[], title: string, isOfficial: (url: string) => boolean): Hit | null {
  return hits.find((h) => isOfficial(h.url) && titleIn(textOf(h), title)) ?? null;
}

/** Pages on job sites that are about salaries, interviews or reviews, not a job advert. */
const NOT_ADVERT = /\/(interview|salary|salaries|review|reviews|questions|benefits|photos|people|in)\b/i;

/** The job site a web address belongs to, when it's one we know (config/lists/job_sources.json). */
export function boardOf(url: string | null | undefined): string | null {
  const h = domainOf(url);
  if (!h) return null;
  const d = Object.keys(BOARDS).find((b) => within(h, b));
  return d ? BOARDS[d]! : null;
}

/**
 * The same job listed under the company's name on a well-known job site (LinkedIn,
 * Indeed, Jobberman...): many companies post only there. The page must be a job advert
 * that names the company and most of the job title.
 */
export function boardListing(hits: Hit[], employer: string, title: string): { board: string; url: string } | null {
  for (const h of hits) {
    const board = boardOf(h.url);
    if (!board) continue;
    let path = "";
    try {
      path = new URL(h.url).pathname + new URL(h.url).search;
    } catch {
      continue;
    }
    if (!/job|listing|viewjob|vacanc|career/i.test(path) || NOT_ADVERT.test(path)) continue;
    const text = textOf(h);
    if (nameIn(text, employer) && titleIn(text, title)) return { board, url: h.url };
  }
  return null;
}
