import "server-only";
import { webSearch, type SearchHit } from "@/lib/search";
import type { ResearchResult } from "@/lib/ai/research";

/**
 * The job check's web research from our own search (D-152), for when Gemini's search isn't
 * available. A few targeted searches (the company's website, the job on its careers page,
 * scam reports about the company and the post's contacts); the results are numbered as
 * sources, so the AI that reads them can only cite what the search really returned.
 */
export async function searchResearch(input: { employer: string | null; title: string | null; emails: string[]; phones: string[] }): Promise<ResearchResult> {
  const { employer, title } = input;
  const queries: string[] = [];
  if (employer) {
    queries.push(`${employer} official website`);
    queries.push(`"${employer}" ${title ?? ""} careers job`.trim());
    queries.push(`"${employer}" recruitment scam OR "fake job"`);
  }
  for (const c of [...input.emails.slice(0, 1), ...input.phones.slice(0, 1)]) queries.push(`"${c}" scam OR fraud`);
  if (!queries.length) return { ok: false };

  const results = await Promise.all(queries.map((q) => webSearch(q, 6)));
  const sources: { url: string; title: string }[] = [];
  const index = new Map<string, number>();
  const lines: string[] = [];
  results.forEach((hits: SearchHit[], qi) => {
    lines.push(`Search: ${queries[qi]}`);
    if (!hits.length) lines.push("(no results)");
    for (const h of hits) {
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
  if (!sources.length) return { ok: false };
  return { ok: true, notes: lines.join("\n").slice(0, 12_000), sources, searches: queries.length };
}
