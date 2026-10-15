"use client";

import { useEffect, useState } from "react";
import type { LegitimacyCheck, LegitimacyView } from "@/lib/legitimacy";
import { ShareCheck } from "./share-check";
import { ShieldSearch, ShieldTick, TickCircle, Danger, Warning2, InfoCircle, ExportSquare, CloseCircle, MinusCircle, Refresh } from "@/components/icons";

const STATE = {
  verified: { tone: "bg-proof-50 text-proof-700 ring-proof-100", icon: ShieldTick, title: "Looks genuine on the checks we could run" },
  unverified: { tone: "bg-care-50 text-care-700 ring-care-100", icon: Warning2, title: "We couldn't confirm it. Be careful." },
  red_flags: { tone: "bg-flag-50 text-flag-700 ring-flag-100", icon: Danger, title: "Red flags found" },
} as const;
/** Couldn't fully confirm, but the company is real and nothing looks wrong (D-156). */
const CALM = { tone: "bg-brand-50 text-brand-800 ring-brand-100", icon: ShieldSearch, title: "No warning signs found" } as const;

const SIGNAL_ICON = {
  red: { icon: Danger, cls: "text-flag-600" },
  amber: { icon: Warning2, cls: "text-care-600" },
  info: { icon: InfoCircle, cls: "text-ink-500" },
  ok: { icon: TickCircle, cls: "text-proof-600" },
} as const;

const CHECK_ICON = {
  pass: { icon: TickCircle, cls: "text-proof-600", word: "Yes" },
  fail: { icon: CloseCircle, cls: "text-flag-600", word: "No" },
  unknown: { icon: MinusCircle, cls: "text-ink-400", word: "Couldn't check" },
} as const;

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function CheckRow({ c, loading }: { c: LegitimacyCheck; loading: boolean }) {
  const pending = loading && c.status === "unknown";
  const ic = CHECK_ICON[c.status];
  const Icon = ic.icon;
  return (
    <li className="flex animate-rise items-start gap-3 py-2.5">
      {pending ? <span className="mt-0.5 size-[18px] shrink-0 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" aria-hidden="true" /> : <Icon size={20} variant="bulk" className={`mt-px shrink-0 ${ic.cls}`} />}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[0.875rem] font-semibold text-ink-900">{c.label}</span>
          <span className={`text-xs font-semibold ${pending ? "text-brand-700" : ic.cls}`}>{pending ? "Checking" : (c.word ?? ic.word)}</span>
        </span>
        {!pending ? <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-600">{c.detail}</span> : null}
        {!pending && c.sourceUrl ? (
          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex items-center gap-1 break-all text-xs font-medium text-brand-700 hover:underline">
            {host(c.sourceUrl)}
            <ExportSquare size={12} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </span>
    </li>
  );
}

/**
 * Is this job real? Instant rule checks show first; the live lookup (company, its age,
 * its website and email, where the job was posted, warnings) fills a checklist that
 * says what passed, what didn't and what we couldn't check. Never says "safe".
 */
/** `ready`: `initial` is the saved check, so nothing is asked again (coming back from the CV screen, D-161). */
export function ScamCheck({ jobId, initial, ready = false, large = false, title = null, employer = null }: { jobId: string; initial: LegitimacyView; ready?: boolean; large?: boolean; title?: string | null; employer?: string | null }) {
  const [view, setView] = useState<LegitimacyView>(initial);
  const [loading, setLoading] = useState(!ready);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (ready && round === 0) return;
    let alive = true;
    fetch(`/api/jobs/${jobId}/legitimacy${round ? "?fresh=1" : ""}`, { method: "POST" })
      .then((r) => r.json())
      .then((d: { ok: boolean; view?: LegitimacyView }) => {
        if (!alive) return;
        if (d.ok && d.view) setView(d.view);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [jobId, round, ready]);

  const again = () => {
    setLoading(true);
    setFailed(false);
    setRound((n) => n + 1);
  };

  const s = view.calm && view.state === "unverified" ? CALM : STATE[view.state];
  const Icon = s.icon;
  // Rule findings from the post itself (fees, WhatsApp only, and so on).
  const flags = view.signals.filter((x) => x.id.startsWith("L1") && x.severity !== "info");

  return (
    <section aria-labelledby="scam-title" aria-busy={loading} className={`rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card ${large ? "p-5 lg:p-6" : "p-5"}`}>
      <h2 id="scam-title" className={`flex items-center gap-2.5 font-display font-semibold tracking-[-0.02em] text-ink-900 ${large ? "text-[1.375rem] leading-8 lg:text-[1.625rem]" : "text-[1.25rem] leading-7"}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <ShieldSearch size={24} variant="bulk" />
        </span>
        Is This Job Real?
      </h2>
      <div aria-live="polite">
        {loading && view.state !== "red_flags" ? (
          <p className="mt-4 flex items-center gap-2.5 rounded-2xl bg-brand-50 px-3.5 py-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-100">
            <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
            Checking the company and where this job was posted. Usually 15 to 45 seconds.
          </p>
        ) : (
          <>
            <p key={view.state} className={`mt-4 flex animate-pop items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-semibold ring-1 ${s.tone}`}>
              <Icon size={22} variant="bulk" />
              {s.title}
            </p>
            <p className="mt-3 text-[0.8125rem] leading-5 text-ink-700">{view.headline}</p>
          </>
        )}

        {flags.length ? (
          <ul className="mt-3 space-y-2">
            {flags.map((sig) => {
              const si = SIGNAL_ICON[sig.severity];
              const SI = si.icon;
              return (
                <li key={`${sig.id}-${sig.text}`} className="flex items-start gap-2.5 rounded-xl bg-ink-50 p-2.5 text-[0.8125rem] leading-5 text-ink-800">
                  <SI size={18} variant="bulk" className={`mt-px shrink-0 ${si.cls}`} />
                  <span className="min-w-0">
                    {sig.text}
                    {sig.evidence ? <span className="mt-0.5 block text-xs italic text-ink-500">&ldquo;{sig.evidence}&rdquo;</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">What We Checked</h3>
        <ul className="mt-1 divide-y divide-ink-100">
          {view.checks.map((c) => (
            <CheckRow key={c.key} c={c} loading={loading} />
          ))}
        </ul>

        {(failed || view.retry) && !loading ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink-50 px-3.5 py-3">
            <p className="text-[0.8125rem] leading-5 text-ink-700">{failed ? "The live check couldn't finish. The checks above still apply." : "Some checks need web search, which was busy."}</p>
            <button type="button" onClick={again} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-semibold text-brand-700 ring-1 ring-ink-150 hover:bg-brand-50">
              <Refresh size={16} />
              Check again
            </button>
          </div>
        ) : null}
        {!loading && !failed ? (
          <div className="mt-4">
            <ShareCheck jobId={jobId} state={view.state} calm={Boolean(view.calm)} title={title} employer={employer} />
          </div>
        ) : null}
        <p className="mt-3 border-t border-ink-100 pt-3 text-xs leading-5 text-ink-500">We describe what we found online. We can&apos;t prove a job is real, so never pay to apply and never share your BVN or bank PIN.</p>
      </div>
    </section>
  );
}
