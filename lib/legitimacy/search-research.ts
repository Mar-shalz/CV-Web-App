import "server-only";
import { webSearch, type SearchHit } from "@/lib/search";
import type { ResearchResult } from "@/lib/ai/research";
import { foundedYear } from "./evidence";
import { LIMITS } from "@/lib/config";

export type SearchHits = { site: SearchHit[]; careers: SearchHit[]; boards: SearchHit[]; all: SearchHit[] };

/** Job sites searched for the same job (D-156): many companies post only there. */
const BOARD_SITES = ["linkedin.com/jobs", "indeed.com", "jobberman.com", "myjobmag.com", "glassdoor.com"];

/**
 * The job check's web research from our own search (D-152), for when Gemini's search isn't
 * available. A few targeted searches (the company's website, the job on its careers page,
 * the job on the big job sites, scam reports about the company and the post's contacts);
 * the results are numbered as sources, so the AI that reads them can only cite what the
 * search really returned. The raw results come back too, for the checks done in code.
 */
export async function searchResearch(input: { employer: string | null; title: string | null; emails: string[]; phones: string[] }): Promise<{ research: ResearchResult; hits: SearchHits | null }> {
  const { employer } = input;
  const title = input.title?.replace(/["()]/g, " ").replace(/\s+/g, " ").trim() || null;
  const queries: { kind: keyof SearchHits | "warnings" | "contacts"; q: string }[] = [];
  if (employer) {
    queries.push({ kind: "site", q: `${employer} official website` });
    queries.push({ kind: "careers", q: `"${employer}" ${title ?? ""} careers job`.trim() });
    if (title) queries.push({ kind: "boards", q: `"${employer}" ${title} (${BOARD_SITES.map((s) => `site:${s}`).join(" OR ")})` });
    queries.push({ kind: "warnings", q: `"${employer}" recruitment scam OR "fake job"` });
  }
  for (const c of [...input.emails.slice(0, 1), ...input.phones.slice(0, 1)]) queries.push({ kind: "contacts", q: `"${c}" scam OR fraud` });
  if (!queries.length) return { research: { ok: false }, hits: null };

  // Facts about the company change slowly; listings and scam reports can change in days (D-200).
  const days = (kind: (typeof queries)[number]["kind"]) => (kind === "site" ? LIMITS.legitimacy.cache_days_employer : LIMITS.legitimacy.cache_days_post);
  const results = await Promise.all(queries.map(({ kind, q }) => webSearch(q, 6, { maxAgeDays: days(kind) })));
  const hits: SearchHits = { site: [], careers: [], boards: [], all: results.flat() };
  queries.forEach(({ kind }, i) => {
    if (kind === "site" || kind === "careers" || kind === "boards") hits[kind] = results[i]!;
  });
  const sources: { url: string; title: string }[] = [];
  const index = new Map<string, number>();
  const lines: string[] = [];
  results.forEach((found: SearchHit[], qi) => {
    lines.push(`Search: ${queries[qi]!.q}`);
    if (!found.length) lines.push("(no results)");
    for (const h of found) {
      let n = index.get(h.url);
      if (n === undefined && sources.length < 30) {
        sources.push({ url: h.url, title: h.title });
        n = sources.length;
        index.set(h.url, n);
      }
      if (n !== undefined) lines.push(`[${n}] ${h.title}: ${h.snippet}`.slice(0, 400));
    }
    lines.push("");
  });
  if (!sources.length) return { research: { ok: false }, hits };
  return { research: { ok: true, notes: lines.join("\n").slice(0, 12_000), sources, searches: queries.length }, hits };
}

/**
 * When the company started (D-156): first from what the other searches already found,
 * then one search of its own ("Cowrywise" founded). Null when no page says.
 */
export async function searchFounded(employer: string, seen: SearchHit[]): Promise<{ year: number; url: string } | null> {
  return foundedYear(seen, employer) ?? foundedYear(await webSearch(`"${employer}" founded`, 8, { maxAgeDays: LIMITS.legitimacy.cache_days_employer }), employer);
}

/**
 * Generic numbered research from a few searches (D-171): the same shape the AI step
 * expects, so it can only cite what the search returned. Used for questions people
 * report from real interviews.
 */
export async function searchNotes(queries: string[], perQuery = 6): Promise<ResearchResult> {
  const results = await Promise.all(queries.map((q) => webSearch(q, perQuery)));
  const sources: { url: string; title: string }[] = [];
  const index = new Map<string, number>();
  const lines: string[] = [];
  results.forEach((found, qi) => {
    lines.push(`Search: ${queries[qi]}`);
    if (!found.length) lines.push("(no results)");
    for (const h of found) {
      let n = index.get(h.url);
      if (n === undefined && sources.length < 30) {
        sources.push({ url: h.url, title: h.title });
        n = sources.length;
        index.set(h.url, n);
      }
      if (n !== undefined) lines.push(`[${n}] ${h.title}: ${h.snippet}`.slice(0, 500));
    }
    lines.push("");
  });
  if (!sources.length) return { ok: false };
  return { ok: true, notes: lines.join("\n").slice(0, 12_000), sources, searches: queries.length };
}

