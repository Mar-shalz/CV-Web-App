import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { listMatches } from "@/lib/jobfeed/match";
import { MatchesView } from "@/components/matches/matches-view";
import { LIMITS } from "@/lib/config";

export const metadata: Metadata = { title: "Jobs for You" };

// The search can run a few fit checks when the page opens (D-205).
export const maxDuration = 300;

export default async function MatchesPage() {
  const viewer = await requireReadyViewer();
  const m = await listMatches(viewer);
  return (
    <div className="space-y-3">
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Jobs for You</h1>
        <p className="mt-1 max-w-3xl text-[0.9375rem] text-ink-600">
          Every day we search employers&apos; own careers pages and remote job boards for jobs like the ones you go for, posted in the last {LIMITS.matches.max_age_days} days. Only jobs you match {LIMITS.matches.min_match}% or more show here. Tailor one and it moves to My Applications. We never apply for you.
        </p>
      </header>
      {m.ready ? (
        <MatchesView items={m.items} searchedAt={m.searchedAt} tailorAhead={m.tailorAhead} preview={viewer.preview} />
      ) : (
        <p className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 text-sm text-ink-600 shadow-card">Jobs for You is almost ready. It switches on after the next app update.</p>
      )}
    </div>
  );
}
