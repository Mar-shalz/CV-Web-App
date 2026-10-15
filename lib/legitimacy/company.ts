import "server-only";
import { normaliseName, domainOf } from "./names";

export { normaliseName, domainOf };

/**
 * Checks that need no web search (D-118), so the scam check still answers the main
 * questions when Google Search is busy or out of quota:
 * - Wikidata, the open company record behind Wikipedia: does the company exist, its
 *   official website and the year it started. Free, no key.
 * - Hiring services: a post on the company's own Greenhouse, Lever, Ashby, Workable or
 *   SmartRecruiters board was posted by the company (only the company controls it).
 */

export type CompanyRecord = { label: string; description: string | null; website: string | null; domain: string | null; founded: number | null; sourceUrl: string };

const UA = "ReceiptsJobCheck/1.0 (job advert scam check; contact via the Receipts app)";
// Organisation descriptions on Wikidata; people, places and names are left out.
const ORG =
  /\b(company|companies|bank|firm|business|startup|start-up|enterprise|conglomerate|corporation|group|agency|ministry|commission|authority|university|school|hospital|organi[sz]ation|institution|manufacturer|retailer|platform|provider|fintech|operator|brand|subsidiary|cooperative|foundation|ngo|charity|airline|insurer|telecommunications|publisher|consultancy|firm)\b/i;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { "user-agent": UA, accept: "application/json" } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };

/** The best Wikidata match for an employer name, or null when there's no organisation by that name. */
export async function wikidataCompany(name: string | null | undefined): Promise<CompanyRecord | null> {
  if (!name || name.trim().length < 2) return null;
  const want = normaliseName(name);
  if (!want) return null;
  const search = await getJson<{ search?: { id: string; label?: string; description?: string }[] }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name.trim().slice(0, 120))}&language=en&type=item&format=json&limit=7`,
  );
  const hits = (search?.search ?? []).filter((h) => {
    const label = normaliseName(h.label ?? "");
    return label && (label === want || label.startsWith(`${want} `) || want.startsWith(`${label} `));
  });
  for (const hit of hits.slice(0, 4)) {
    const data = await getJson<{ entities?: Record<string, { claims?: Record<string, Claim[]>; labels?: { en?: { value?: string } } }> }>(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`);
    const entity = data?.entities ? Object.values(data.entities)[0] : undefined;
    if (!entity) continue;
    const claims = entity.claims ?? {};
    const website = (claims.P856?.[0]?.mainsnak?.datavalue?.value as string | undefined) ?? null;
    const time = (claims.P571?.[0]?.mainsnak?.datavalue?.value as { time?: string } | undefined)?.time ?? null;
    const year = time ? Number(time.slice(1, 5)) : null;
    // Only organisations: an official website, or a description that says what kind of body it is.
    if (!website && !ORG.test(hit.description ?? "")) continue;
    return {
      label: entity.labels?.en?.value ?? hit.label ?? name,
      description: hit.description ?? null,
      website,
      domain: domainOf(website),
      founded: year && year > 1700 && year <= new Date().getFullYear() ? year : null,
      sourceUrl: `https://www.wikidata.org/wiki/${hit.id}`,
    };
  }
  return null;
}

/**
 * DuckDuckGo's instant answer (D-152): free, no key, built on Wikipedia and official site
 * data. Catches companies Wikidata misses (Kuda, for one). Only an exact name match counts.
 */
export async function ddgCompany(name: string | null | undefined): Promise<CompanyRecord | null> {
  if (!name || name.trim().length < 2) return null;
  const want = normaliseName(name);
  const d = await getJson<{ Heading?: string; Abstract?: string; AbstractURL?: string; Results?: { FirstURL?: string }[]; Infobox?: { content?: { label?: string; value?: unknown }[] } }>(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(name.trim().slice(0, 120))}&format=json&no_html=1&skip_disambig=1`,
  );
  if (!d?.Heading || !d.AbstractURL) return null;
  const got = normaliseName(d.Heading);
  if (!(got === want || got.startsWith(`${want} `) || want.startsWith(`${got} `))) return null;
  // People, places and films have abstracts too: keep organisations only.
  const abstract = d.Abstract ?? "";
  if (!ORG.test(abstract.slice(0, 300))) return null;
  const website = d.Results?.[0]?.FirstURL ?? null;
  const foundedRaw = d.Infobox?.content?.find((c) => /^founded/i.test(c.label ?? ""))?.value;
  const year = typeof foundedRaw === "string" ? Number(foundedRaw.match(/\b(1[7-9]\d{2}|20\d{2})\b/)?.[1]) : NaN;
  const first = abstract.split(/(?<=\.)\s/)[0] ?? "";
  const description = first.replace(/\.$/, "").slice(0, 140) || null;
  return { label: d.Heading, description, website, domain: domainOf(website), founded: Number.isFinite(year) && year <= new Date().getFullYear() ? year : null, sourceUrl: d.AbstractURL };
}

/** The company's public record: Wikidata first, then DuckDuckGo's instant answer. */
export async function companyRecord(name: string | null | undefined): Promise<CompanyRecord | null> {
  const [wiki, ddg] = await Promise.all([wikidataCompany(name), ddgCompany(name)]);
  if (!wiki) return ddg;
  // Wikidata can lack the website or founding year; DuckDuckGo often has them.
  return { ...wiki, website: wiki.website ?? ddg?.website ?? null, domain: wiki.domain ?? ddg?.domain ?? null, founded: wiki.founded ?? ddg?.founded ?? null };
}

/** Hiring services a company signs up to; the first part of the path is the company's own board. */
const ATS: { host: RegExp; service: string; slug: (u: URL) => string | null }[] = [
  { host: /(^|\.)greenhouse\.io$/i, service: "Greenhouse", slug: (u) => u.pathname.split("/")[1] || u.searchParams.get("for") },
  { host: /^jobs(\.eu)?\.lever\.co$/i, service: "Lever", slug: (u) => u.pathname.split("/")[1] || null },
  { host: /^jobs\.ashbyhq\.com$/i, service: "Ashby", slug: (u) => u.pathname.split("/")[1] || null },
  { host: /^apply\.workable\.com$/i, service: "Workable", slug: (u) => u.pathname.split("/")[1] || null },
  { host: /^(jobs|careers)\.smartrecruiters\.com$/i, service: "SmartRecruiters", slug: (u) => u.pathname.split("/")[1] || null },
  { host: /\.myworkdayjobs\.com$/i, service: "Workday", slug: (u) => u.hostname.split(".")[0] ?? null },
  { host: /\.bamboohr\.com$/i, service: "BambooHR", slug: (u) => u.hostname.split(".")[0] ?? null },
  { host: /\.recruitee\.com$/i, service: "Recruitee", slug: (u) => u.hostname.split(".")[0] ?? null },
  { host: /\.teamtailor\.com$/i, service: "Teamtailor", slug: (u) => u.hostname.split(".")[0] ?? null },
];

export type HiringBoard = { service: string; slug: string; matchesEmployer: boolean };

/** The hiring service and board behind a link, and whether the board's name matches the employer. */
export function hiringBoard(url: string | null | undefined, employer: string | null | undefined): HiringBoard | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const ats = ATS.find((a) => a.host.test(u.hostname));
  const slug = ats?.slug(u)?.toLowerCase();
  if (!ats || !slug) return null;
  const tokens = normaliseName(employer ?? "")
    .split(" ")
    .filter((w) => w.length >= 3);
  const flat = slug.replace(/[^a-z0-9]/g, "");
  const matchesEmployer = tokens.length > 0 && (flat.includes(tokens.join("")) || tokens.some((t) => t.length >= 5 && flat.includes(t)));
  return { service: ats.service, slug, matchesEmployer };
}

export const isAtsHost = (h: string) => ATS.some((a) => a.host.test(h));
