"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MatchView } from "@/lib/jobfeed/match";
import { acceptMatch, dismissMatch, searchMatches, tailorAheadNow } from "@/app/(app)/matches/actions";
import { toast } from "@/components/ui/toaster";
import { Button, ButtonLink } from "@/components/ui/button";
import { Magicpen, Global, Calendar, Location, Refresh2, SearchStatus, TickCircle, ArrowRight2, CloseCircle, Export, Setting2 } from "@/components/icons";

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
 * Jobs for you (founder rounds 34 to 38, D-205, D-208, D-209): what the daily search found
 * that the person matches `minMatch`% or more. The search runs on its own each day; opening the page runs it
 * when the last one is a day old. Tailor moves a job to their CV and then My Applications.
 * Tailor ahead is switched in Settings; this page says plainly whether it's on and links
 * there to change it (founder round 36). While it's on, opening the page writes CVs for
 * the jobs here that don't have one yet, `perRun` at a time (founder round 38). The list
 * comes newest first: jobs new on it, marked New, then the most recently posted (round 39).
 */
export function MatchesView({ items: initial, searchedAt, tailorAhead: ahead, preview, minMatch, perRun }: { items: MatchView[]; searchedAt: string | null; tailorAhead: boolean; preview: boolean; minMatch: number; perRun: number }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [searching, setSearching] = useState(false);
  const [busy, start] = useTransition();
  const [writing, startWriting] = useTransition();
  const [aheadNote, setAheadNote] = useState<string | null>(null);
  const started = useRef(false);
  const waiting = items.filter((m) => !m.tailored);
  const nowWriting = new Set(writing ? waiting.slice(0, perRun).map((m) => m.id) : []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(initial), [initial]);

  function search(manual: boolean) {
    setSearching(true);
    start(async () => {
      const res = await searchMatches();
      setSearching(false);
      if ("error" in res) return toast(res.error, "error");
      if (!res.ran && res.matched) toast(`${res.matched} more ${res.matched === 1 ? "job fits" : "jobs fit"} you.`);
      else if (manual && !res.ran && res.reason === "recent") toast("We searched in the last few hours. New jobs show up here as we find them.", "info");
      if (manual && res.reason === "no_roles") toast("Check a job or two you'd like first, so we know which roles to look for.", "info");
      if (res.ran) toast(res.matched ? `${res.matched} new ${res.matched === 1 ? "job fits" : "jobs fit"} you.` : `No new jobs at ${minMatch}% or more this time. We'll look again tomorrow.`);
      if (res.tailored) toast(`Your CV is ready for ${res.tailored} ${res.tailored === 1 ? "job" : "jobs"}.`);
      router.refresh();
    });
  }

  // Tailor ahead: CVs for the jobs here that don't have one yet, a few at a time.
  function writeCvs() {
    startWriting(async () => {
      const res = await tailorAheadNow();
      setAheadNote(res.error ?? null);
      if (res.tailored) toast(`Your CV is ready for ${res.tailored} ${res.tailored === 1 ? "job" : "jobs"}.`);
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
    // The search writes Tailor ahead CVs when it's done, so this runs only without one.
    else if (ahead && waiting.length) writeCvs();
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

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${ahead ? "bg-proof-50 text-proof-700" : "bg-ink-75 text-ink-600"}`}>
            <Magicpen size={20} variant="bulk" />
          </span>
          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
              Tailor ahead
              <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] ${ahead ? "bg-proof-50 text-proof-700 ring-1 ring-proof-100" : "bg-ink-100 text-ink-600"}`}>{ahead ? "On" : "Off"}</span>
            </p>
            <p className="mt-0.5 max-w-xl text-[0.8125rem] leading-5 text-ink-600">
              {ahead ? "Tailor ahead is on: we write your CV for each job here, a few at a time, so it's ready when you look." : "We write your CV when you tap Tailor my CV. Turn on Tailor ahead to have it ready as soon as a job matches."}
            </p>
            {ahead && aheadNote ? <p className="mt-1 max-w-xl text-[0.8125rem] font-medium leading-5 text-flag-700">{aheadNote}</p> : null}
            <ButtonLink href="/settings#tailor-ahead" variant="secondary" size="sm" className="mt-2.5">
              <Setting2 size={16} />
              {ahead ? "Turn off in Settings" : "Turn on in Settings"}
            </ButtonLink>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-500">
            {searched(searchedAt)}
            {items.length > 1 ? " · Newest first" : ""}
          </span>
          <Button pending={busy || searching} variant="secondary" size="sm" onClick={() => search(true)} disabled={busy || searching || preview}>
            <Refresh2 size={16} />
            Search now
          </Button>
        </div>
      </section>

      {searching || writing ? (
        <p aria-live="polite" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-4 text-sm font-medium text-brand-800">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-600 border-r-transparent" aria-hidden="true" />
          {searching
            ? "Looking for new jobs that fit you and checking the best ones against your experience. This can take a minute or two."
            : `Tailor ahead is writing your CV for ${Math.min(perRun, waiting.length)} ${Math.min(perRun, waiting.length) === 1 ? "job" : "jobs"} below. This can take a minute.`}
        </p>
      ) : null}

      {items.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((m) => (
            <li key={m.id} className="@container flex flex-col rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                {m.isNew ? <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-white">New</span> : null}
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
                {m.tailored ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">CV ready</span>
                ) : nowWriting.has(m.id) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-75 px-2 py-0.5 text-xs font-semibold text-ink-700">
                    <span className="size-3 animate-spin rounded-full border-[1.5px] border-ink-500 border-r-transparent" aria-hidden="true" />
                    Writing your CV
                  </span>
                ) : null}
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
              <div className="mt-auto grid gap-2 pt-4 @md:grid-cols-3">
                <Button pending={busy} onClick={() => tailor(m)} disabled={busy || nowWriting.has(m.id)} className="whitespace-nowrap @md:px-3">
                  <Magicpen size={18} variant="bulk" />
                  {m.tailored ? "Review my CV" : "Tailor my CV"}
                </Button>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-ink-200 px-3 text-sm font-semibold text-ink-800 hover:bg-ink-75">
                  View job <Export size={16} />
                </a>
                <button type="button" onClick={() => dismiss(m)} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-3 text-sm font-semibold text-ink-500 hover:bg-ink-75 hover:text-ink-800">
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
          <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] leading-6 text-ink-600">We look every day and only show jobs you match {minMatch}% or more, so this list stays short and worth your time.</p>
          <ul className="mx-auto mt-4 max-w-sm space-y-2 text-left text-[0.8125rem] leading-5 text-ink-700">
            <li className="flex gap-2">
              <ArrowRight2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
              Confirm more of your experience: the fuller it is, the more jobs reach {minMatch}%.
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
