import "server-only";
import { httpsOnly, plainText, type FeedJob } from "./types";

// Headcount Labs (D-205): jobs read daily from employers' own career pages and hiring
// systems (Greenhouse, Lever, Workday, SmartRecruiters and more). 100,000 records a month
// free, then $0.01 per 1,000. Needs HEADCOUNT_API_KEY. Job text is untrusted input.

type Known<T> = { state: "known"; value: T } | { state: string; value?: undefined };
type HcPosting = { posting_url?: Known<string>; application_url?: Known<string>; source_posted_at?: string | null; first_seen_at?: string; attribution?: { required?: boolean | null; text?: string | null; link?: string | null } | null; posting_status?: string };
type HcJob = {
  job_id: string;
  title?: Known<string>;
  employer_name?: Known<string>;
  description?: Known<string>;
  work_arrangement?: Known<string>;
  locations?: Known<{ city?: string | null; region?: string | null; country?: string | null }>[];
  job_first_seen_at?: string;
  postings?: HcPosting[];
};

const STOP = new Set(["and", "or", "the", "of", "for", "in", "a", "an", "to", "with", "at", "&"]);
const val = <T,>(f: Known<T> | undefined): T | null => (f && f.state === "known" ? (f.value as T) : null);

/** The words of a role as a title search: every word must appear, in any order. */
export function titleQuery(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 5)
    .join(" & ");
}

export function enabled(): boolean {
  return Boolean(process.env.HEADCOUNT_API_KEY);
}

export async function searchHeadcount(role: string, countries: string[], since: string): Promise<FeedJob[] | null> {
  const key = process.env.HEADCOUNT_API_KEY;
  const q = titleQuery(role);
  if (!key || !q) return null;
  const params = new URLSearchParams({ title_advanced: q, posted_since: since, active: "true", has_description: "true", has_application_url: "true", limit: "40", sort: "updated", description_format: "text" });
  if (countries.length) params.set("country", countries.slice(0, 10).join(","));
  try {
    const res = await fetch(`https://api.headcountlabs.com/v1/jobs?${params}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: HcJob[] };
    return (data.data ?? []).flatMap((j): FeedJob[] => {
      const title = val(j.title);
      const employer = val(j.employer_name);
      const posting = (j.postings ?? []).find((p) => p.posting_status !== "no_longer_listed") ?? j.postings?.[0];
      const url = httpsOnly(val(posting?.application_url)) ?? httpsOnly(val(posting?.posting_url));
      if (!title || !employer || !url) return [];
      const places = (j.locations ?? []).map((l) => val(l)).filter((l): l is NonNullable<typeof l> => Boolean(l));
      const where = places[0] ? [places[0].city, places[0].region, places[0].country].filter(Boolean).join(", ") : null;
      const a = posting?.attribution;
      return [
        {
          source: "headcount",
          sourceId: j.job_id,
          title: title.slice(0, 300),
          employer: employer.slice(0, 200),
          location: where?.slice(0, 200) ?? null,
          countries: [...new Set(places.map((p) => (p.country ?? "").toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))],
          remote: val(j.work_arrangement) === "remote",
          postedAt: posting?.source_posted_at ?? posting?.first_seen_at ?? j.job_first_seen_at ?? null,
          url,
          description: plainText(val(j.description) ?? "").slice(0, 12_000),
          credit: a?.required && a.text && httpsOnly(a.link) ? { text: a.text.slice(0, 120), link: a.link! } : null,
        },
      ];
    });
  } catch {
    return null;
  }
}
