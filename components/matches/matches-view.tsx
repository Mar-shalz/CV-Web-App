"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MatchView } from "@/lib/jobfeed/match";
import { acceptMatch, dismissMatch, searchMatches, setTailorAhead } from "@/app/(app)/matches/actions";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Magicpen, Global, Calendar, Location, Refresh2, SearchStatus, TickCircle, ArrowRight2, CloseCircle, Export } from "@/components/icons";

const HOUR = 3_600_000;
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
const when = (iso: string | null) => {
  if (!iso) return null;
  const d = daysAgo(iso);
  return d === 0 ? "Posted today" : d === 1 ? "Posted yesterday" : `Posted ${d} days ago`;
};
const searched = (iso: string | null) => {
  if (!iso) return "Not searched yet";
  const h = Math.floor((Date.now() - Date.parse(iso)) / HOUR);
  return h < 1 ? "Searched just now" : h < 24 ? `Searched ${h} ${h === 1 ? "hour" : "hours"} ago` : `Searched ${Math.floor(h / 24)} days ago`;
};

/**
 * Jobs for you (founder rounds 34 and 35, D-205): what the daily search found that the
 * person matches 90% or more. The search runs on its own each day; opening the page runs it
 * when the last one is a day old. Tailor moves a job to their CV and then My Applications.
 */
export function MatchesView({ items: initial, searchedAt, tailorAhead: initialAhead, preview }: { items: MatchView[]; searchedAt: string | null; tailorAhead: boolean; preview: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [searching, setSearching] = useState(false);
  const [ahead, setAhead] = useState(initialAhead);
  const [busy, start] = useTransition();
  const started = useRef(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(initial), [initial]);

  function search(manual: boolean) {
    setSearching(true);
    start(async () => {
      const res = await searchMatches();
      setSearching(false);
      if ("error" in res) return toast(res.error, "error");
      if (manual && !res.ran && res.reason === "recent") toast("We searched in the last few hours. New jobs show up here as we find them.", "info");
      if (manual && res.reason === "no_roles") toast("Check a job or two you'd like first, so we know which roles to look for.", "info");
      if (res.ran) toast(res.matched ? `${res.matched} new ${res.matched === 1 ? "job fits" : "jobs fit"} you.` : "No new jobs at 90% or more this time. We'll look again tomorrow.");
      router.refresh();
    });
  }

  // The daily search, when the last one is a day old (once per visit).
  useEffect(() => {
    if (started.current || preview) return;
    started.current = true;
    // Runs once on open; search() reads nothing that changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!searchedAt || Date.now() - Date.parse(searchedAt) > 20 * HOUR) search(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tailor(m: MatchView) {
    start(async () => {
      const res = await acceptMatch(m.id);
      if (!res.ok) return toast(res.error, "error");
      router.push(res.href);
    });
  }

  function dismiss(m: MatchView) {
    setItems((xs) => xs.filter((x) => x.id !== m.id));
    start(async () => {
      await dismissMatch(m.id);
      toast("Taken off your list.");
    });
  }

  function toggleAhead(on: boolean) {
    setAhead(on);
    start(async () => {
      const res = await setTailorAhead(on);
      if (!res.ok) {
        setAhead(!on);
        return toast(res.error ?? "We couldn't save that.", "error");
      }
      toast(on ? "We'll write the CV as soon as a job matches." : "We'll write the CV when you tap Tailor.");
    });
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" role="switch" checked={ahead} onChange={(e) => toggleAhead(e.target.checked)} className="mt-1 size-5 accent-brand-600" />
          <span>
            <span className="block text-sm font-semibold text-ink-900">Tailor ahead</span>
            <span className="block text-[0.8125rem] leading-5 text-ink-600">{ahead ? "Your CV is written as soon as a job matches, ready when you look." : "Off: your CV is written when you tap Tailor, so none are made for jobs you skip."}</span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-500">{searched(searchedAt)}</span>
          <Button variant="secondary" size="sm" onClick={() => search(true)} disabled={busy || searching || preview}>
            <Refresh2 size={16} />
            Search now
          </Button>
        </div>
      </section>

      {searching ? (
        <p aria-live="polite" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-4 text-sm font-medium text-brand-800">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-600 border-r-transparent" aria-hidden="true" />
          Looking for new jobs that fit you and checking the best ones against your experience. This can take a minute or two.
        </p>
      ) : null}

      {items.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((m) => (
            <li key={m.id} className="flex flex-col rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-proof-50 px-2.5 py-1 text-xs font-bold text-proof-700 ring-1 ring-proof-100">
                  <TickCircle size={14} variant="bulk" />
                  {m.percent}% match
                </span>
                {m.postedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                    <Calendar size={14} />
                    {when(m.postedAt)}
                  </span>
                ) : null}
                {m.tailored ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">CV ready</span> : null}
              </div>
              <h3 className="mt-2 text-[1.0625rem] font-semibold leading-6 text-ink-900">{m.title}</h3>
              <p className="text-sm text-ink-600">{m.employer}</p>
              {m.location ? (
                <p className="mt-1 flex items-center gap-1 text-[0.8125rem] text-ink-500">
                  {m.remote ? <Global size={14} /> : <Location size={14} />}
                  {m.location}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-ink-500">
                {m.credit ? (
                  <a href={m.credit.link} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    {m.credit.text}
                  </a>
                ) : (
                  "From the employer's own careers page"
                )}
                {m.jobId ? (
                  <>
                    {" · "}
                    <Link href={`/jobs/${m.jobId}/check`} className="font-semibold text-brand-700 hover:underline">
                      See why it fits
                    </Link>
                  </>
                ) : null}
              </p>
              <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-[1fr_auto_auto]">
                <Button onClick={() => tailor(m)} disabled={busy}>
                  <Magicpen size={18} variant="bulk" />
                  {m.tailored ? "Review my CV" : "Tailor my CV"}
                </Button>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-ink-200 px-4 text-sm font-semibold text-ink-800 hover:bg-ink-75">
                  View job <Export size={16} />
                </a>
                <button type="button" onClick={() => dismiss(m)} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-semibold text-ink-500 hover:bg-ink-75 hover:text-ink-800">
                  <CloseCircle size={16} />
                  Not for me
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : !searching ? (
        <section className="mx-auto max-w-xl rounded-[var(--radius-card)] border border-ink-150 bg-white p-8 text-center shadow-card">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-700">
            <SearchStatus size={30} variant="bulk" />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold text-ink-900">No Matches Yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] leading-6 text-ink-600">We look every day and only show jobs you match 90% or more, so this list stays short and worth your time.</p>
          <ul className="mx-auto mt-4 max-w-sm space-y-2 text-left text-[0.8125rem] leading-5 text-ink-700">
            <li className="flex gap-2">
              <ArrowRight2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
              Confirm more of your experience: the fuller it is, the more jobs reach 90%.
            </li>
            <li className="flex gap-2">
              <ArrowRight2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
              Check a job you like: we search for roles like the ones you go for.
            </li>
          </ul>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/experience" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
              My experience
            </Link>
            <Link href="/jobs/new" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-ink-200 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-75">
              Check a job
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
