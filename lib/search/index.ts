import "server-only";
import { LIMITS } from "@/lib/config";
import { lookupKey, readLookup, writeLookup } from "@/lib/cache/lookup";

// Web search for the job check (D-152). Gemini's own Google Search needs a paid Gemini
// key; any one of these keys gives the check its own search instead. The results (title,
// address and snippet) then go to the AI to read, which works on the free Gemini key.
//   SERPER_API_KEY    serper.dev, Google results, 2,500 free searches to start
//   BRAVE_SEARCH_API_KEY   api.search.brave.com, free plan of 2,000 searches a month
//   GOOGLE_CSE_KEY + GOOGLE_CSE_ID   Google Programmable Search, 100 free a day

export type SearchHit = { title: string; url: string; snippet: string };

/**
 * Up to `n` results, or [] when no search is set up or it fails. Our own record comes
 * first (D-200): the same search made in the last `maxAgeDays` days (config
 * limits.search.cache_days by default) is answered from it, at no cost.
 */
export async function webSearch(q: string, n = 8, opts: { maxAgeDays?: number } = {}): Promise<SearchHit[]> {
  const provider = searchProvider();
  if (!provider) return [];
  const query = q.replace(/\s+/g, " ").trim().slice(0, 300);
  const key = lookupKey("search", [provider, n, query.toLowerCase()]);
  const saved = await readLookup<SearchHit[]>(key, opts.maxAgeDays ?? LIMITS.search.cache_days);
  if (saved) return saved;
  const hits = await fetchSearch(query, n);
  if (hits) await writeLookup("search", key, hits, query);
  return hits ?? [];
}

const get = async (url: string, init: RequestInit) => {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
};

export function searchProvider(): "serper" | "brave" | "google" | null {
  if (process.env.SERPER_API_KEY) return "serper";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_ID) return "google";
  return null;
}

/** Asks the search provider. Null when it fails, so a failure is never saved as "no results". */
async function fetchSearch(query: string, n: number): Promise<SearchHit[] | null> {
  switch (searchProvider()) {
    case "serper": {
      const d = (await get("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ q: query, num: n, gl: "ng" }) })) as {
        organic?: { title?: string; link?: string; snippet?: string }[];
        knowledgeGraph?: { title?: string; website?: string; descriptionLink?: string; description?: string; attributes?: Record<string, string> };
      } | null;
      if (!d) return null;
      const hits = (d.organic ?? []).slice(0, n).flatMap((r) => (r.link ? [{ title: r.title ?? r.link, url: r.link, snippet: r.snippet ?? "" }] : []));
      // Google's panel about the company, when it shows one ("Founded: 2017", its website).
      const kg = d.knowledgeGraph;
      const kgUrl = kg?.website ?? kg?.descriptionLink;
      if (kg?.title && kgUrl) hits.unshift({ title: kg.title, url: kgUrl, snippet: [kg.description, ...Object.entries(kg.attributes ?? {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(". ") });
      return hits;
    }
    case "brave": {
      const d = (await get(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${n}`, { headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY! } })) as { web?: { results?: { title?: string; url?: string; description?: string }[] } } | null;
      if (!d) return null;
      return (d.web?.results ?? []).slice(0, n).flatMap((r) => (r.url ? [{ title: r.title ?? r.url, url: r.url, snippet: (r.description ?? "").replace(/<[^>]+>/g, "") }] : []));
    }
    case "google": {
      const d = (await get(`https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(process.env.GOOGLE_CSE_KEY!)}&cx=${encodeURIComponent(process.env.GOOGLE_CSE_ID!)}&num=${Math.min(n, 10)}&q=${encodeURIComponent(query)}`, {})) as { items?: { title?: string; link?: string; snippet?: string }[] } | null;
      if (!d) return null;
      return (d.items ?? []).flatMap((r) => (r.link ? [{ title: r.title ?? r.link, url: r.link, snippet: r.snippet ?? "" }] : []));
    }
    default:
      return null;
  }
}
