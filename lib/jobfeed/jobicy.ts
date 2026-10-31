import "server-only";
import { httpsOnly, plainText, type FeedJob } from "./types";

// Jobicy (D-205): a free feed of remote jobs from the last 7 days, no key. Its terms: credit
// Jobicy with a link, and send people to the listing's own Jobicy page to apply. Called at
// most once an hour for the same search (results are shared for a day). Job text is
// untrusted input.

type JobicyJob = { id?: number; url?: string; jobTitle?: string; companyName?: string; jobGeo?: string; jobLevel?: string; jobDescription?: string; jobExcerpt?: string; pubDate?: string };

/** A date the feed gives, as ISO, or null when it can't be read. */
function isoDate(v: string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const GEO: Record<string, string> = { USA: "US", UK: "GB", CANADA: "CA", UAE: "AE", NIGERIA: "NG", IRELAND: "IE", GERMANY: "DE" };

export async function searchJobicy(role: string): Promise<FeedJob[] | null> {
  const tag = role.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!tag) return null;
  try {
    const res = await fetch(`https://jobicy.com/api/jobs?count=50&tag=${encodeURIComponent(tag)}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { jobs?: JobicyJob[] };
    return (data.jobs ?? []).flatMap((j): FeedJob[] => {
      const url = httpsOnly(j.url);
      if (!j.id || !j.jobTitle || !j.companyName || !url) return [];
      const geo = (j.jobGeo ?? "").trim();
      const codes = geo
        .split(/[,/]| or /i)
        .map((g) => GEO[g.trim().toUpperCase()] ?? null)
        .filter((c): c is string => Boolean(c));
      return [
        {
          source: "jobicy",
          sourceId: String(j.id),
          title: plainText(j.jobTitle).slice(0, 300),
          employer: plainText(j.companyName).slice(0, 200),
          location: geo ? `Remote (${geo})`.slice(0, 200) : "Remote",
          countries: codes,
          remote: true,
          postedAt: isoDate(j.pubDate),
          url,
          description: plainText(j.jobDescription ?? j.jobExcerpt ?? "").slice(0, 12_000),
          credit: { text: "Listed on Jobicy", link: url },
        },
      ];
    });
  } catch {
    return null;
  }
}
