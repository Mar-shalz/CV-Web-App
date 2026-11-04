import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { listMatches } from "@/lib/jobfeed/match";
import { MatchesView } from "@/components/matches/matches-view";
import Link from "next/link";
import { LIMITS } from "@/lib/config";
import { countryNames, reachOf } from "@/lib/markets";

export const metadata: Metadata = { title: "Jobs for You" };

// Opening the page runs the search, fit checks included, when the cron hasn't reached them (D-205, D-211).
export const maxDuration = 300;

export default async function MatchesPage() {
  const viewer = await requireReadyViewer();
  const m = await listMatches(viewer);
  const home = countryNames([viewer.homeCountry]);
  const { away } = reachOf(viewer.targetMarkets, viewer.homeCountry);
  return (
    <div className="space-y-3">
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Jobs for You</h1>
        <p className="mt-1 text-[0.9375rem] text-ink-600">
          Every day we search employers&apos; own careers pages and remote job boards for jobs like the ones you go for, posted in the last {LIMITS.matches.max_age_days} days. Only jobs you match {LIMITS.matches.min_match}% or more show here. Tailor one and it moves to My Applications. We never apply for you.
        </p>
        <p className="mt-1.5 text-[0.8125rem] text-ink-500">
          Jobs in {home}, {away.length ? <>office jobs abroad that offer visa sponsorship ({countryNames(away)}), </> : null}and remote jobs open to people in {home}.{" "}
          <Link href="/onboarding/setup" className="font-semibold text-brand-700 hover:underline">
            Change where you live or apply
          </Link>
        </p>
      </header>
      {m.ready ? (
        <MatchesView items={m.items} searchedAt={m.searchedAt} tailorAhead={m.tailorAhead} preview={viewer.preview} minMatch={LIMITS.matches.min_match} perRun={LIMITS.matches.tailor_ahead_per_run} />
      ) : (
        <p className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 text-sm text-ink-600 shadow-card">Jobs for You is almost ready. It switches on after the next app update.</p>
      )}
    </div>
  );
}
