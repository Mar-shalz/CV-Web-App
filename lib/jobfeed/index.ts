import "server-only";
import { LIMITS } from "@/lib/config";
import { lookupKey, readLookup, writeLookup } from "@/lib/cache/lookup";
import { enabled as headcountOn, searchHeadcount } from "./headcount";
import { searchJobicy } from "./jobicy";
import type { FeedJob, FeedSource } from "./types";

export type { FeedJob, FeedSource } from "./types";

/**
 * One role's jobs from one source, shared by everyone searching the same role in the same
 * places for a day (founder round 35: people with the same career share the search). Only
 * public job posts go in our records.
 */
async function shared(source: FeedSource, role: string, countries: string[], run: () => Promise<FeedJob[] | null>): Promise<FeedJob[]> {
  const key = lookupKey("job_feed", [source, role.toLowerCase().replace(/\s+/g, " ").trim(), [...countries].sort()]);
  const saved = await readLookup<FeedJob[]>(key, LIMITS.matches.feed_cache_hours / 24);
  if (saved) return saved;
  const jobs = await run();
  if (jobs) await writeLookup("job_feed", key, jobs, `${source}: ${role} (${countries.join(",") || "remote"})`);
  return jobs ?? [];
}

/** Every job the sources have for these roles and places, posted on or after `since` (YYYY-MM-DD). */
export async function findJobs(roles: string[], countries: string[], since: string): Promise<FeedJob[]> {
  const runs = roles.flatMap((role) => [
    ...(headcountOn() ? [shared("headcount", role, countries, () => searchHeadcount(role, countries, since))] : []),
    shared("jobicy", role, [], () => searchJobicy(role)),
  ]);
  const seen = new Set<string>();
  return (await Promise.all(runs)).flat().filter((j) => {
    const k = `${j.source}:${j.sourceId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
