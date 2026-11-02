import list from "@/config/lists/remote_regions.json";
import type { Reach } from "@/lib/markets";

// Where a found job can be done from, and whether that suits the person (founder rounds 40
// and 41, D-211, D-212): jobs in the country they live in, remote jobs open to people there,
// and office jobs in the countries they apply to abroad. Pure, so it is unit tested. Read from what the source published, or from
// the location we saved for a job already on someone's list.

export type Place = { countries: string[]; anywhere: boolean };

const REGIONS = list.regions as Record<string, string[]>;
const NAMES = list.names as Record<string, string>;
const ANYWHERE = new Set(list.anywhere);

/** The countries a job board's place text names: "USA", "Canada, USA", "EMEA", "Anywhere". */
export function parseGeo(geo: string | null | undefined): Place {
  const codes = new Set<string>();
  let anywhere = false;
  for (const raw of (geo ?? "").split(/,|\/|;|\||&|\band\b|\bor\b/i)) {
    const t = raw.toLowerCase().replace(/\bonly\b/g, "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (ANYWHERE.has(t)) anywhere = true;
    else if (REGIONS[t]) REGIONS[t].forEach((c) => codes.add(c));
    else if (NAMES[t]) codes.add(NAMES[t]);
    else if (/^[a-z]{2}$/.test(t) && /^[A-Z]{2}$/.test(raw.trim())) codes.add(raw.trim());
  }
  return { countries: [...codes], anywhere };
}

/**
 * Where a job is, from its source and location: a remote board's "Remote (EMEA)", or an
 * employer's "Lagos, Lagos, NG". `countries` (the employer's own list, when we have it) wins.
 * A job we can't place has no countries, so it isn't shown.
 */
export function placeOf(job: { source: string; location: string | null; countries?: string[] }): Place {
  // Long lists are cut at 200 characters, sometimes before the closing bracket.
  if (job.source === "jobicy") return parseGeo(/\((.*?)\)?\s*$/.exec(job.location ?? "")?.[1] ?? "");
  if (job.countries?.length) return { countries: job.countries, anywhere: false };
  const last = (job.location ?? "").split(",").at(-1)?.trim() ?? "";
  return /^[A-Z]{2}$/.test(last) ? { countries: [last], anywhere: false } : parseGeo(last);
}

/** In the country they live in, or remote and open to people there. */
export function openTo(place: Place, home: string): boolean {
  return place.anywhere || place.countries.includes(home);
}

/**
 * Jobs for You's rule: in the country they live in, remote and open to people there, or an
 * office job in a country they apply to. A remote job tied to another country (US only, say)
 * needs the right to live and work there, so it isn't shown to people living elsewhere.
 */
export function fits(job: { source: string; location: string | null; countries?: string[]; remote: boolean }, reach: Reach): boolean {
  const place = placeOf(job);
  return openTo(place, reach.home) || (!job.remote && place.countries.some((c) => reach.away.includes(c)));
}
