"use client";

import { useEffect, useState } from "react";
import type { LegitimacyView } from "@/lib/legitimacy";
import { ShieldSearch, ShieldTick, TickCircle, Danger, Warning2, InfoCircle, ExportSquare } from "@/components/icons";

const STATE = {
  verified: { tone: "bg-proof-50 text-proof-700", icon: ShieldTick, title: "Verified on an official channel" },
  unverified: { tone: "bg-care-50 text-care-700", icon: Warning2, title: "Couldn't verify. Be careful." },
  red_flags: { tone: "bg-flag-50 text-flag-700", icon: Danger, title: "Red flags found" },
} as const;

const SIGNAL_ICON = {
  red: { icon: Danger, cls: "text-flag-600" },
  amber: { icon: Warning2, cls: "text-care-600" },
  info: { icon: InfoCircle, cls: "text-ink-500" },
  ok: { icon: TickCircle, cls: "text-proof-600" },
} as const;

/**
 * The scam check: Layer 1 rules show instantly; the live lookup streams in and
 * replaces them. Never says a job is "safe".
 */
export function ScamCheck({ jobId, initial }: { jobId: string; initial: LegitimacyView }) {
  const [view, setView] = useState<LegitimacyView>(initial);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/${jobId}/legitimacy`, { method: "POST" })
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
  }, [jobId]);

  const s = STATE[view.state];
  const Icon = s.icon;
  const signals = view.signals.filter((x) => x.severity !== "info" || x.id === "L1-00");

  return (
    <section aria-labelledby="scam-title" aria-busy={loading} className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <h2 id="scam-title" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-900">
        <ShieldSearch size={20} variant="bulk" className="text-brand-600" />
        Is this job genuine?
      </h2>
      <div aria-live="polite">
        <p key={view.state} className={`mt-4 flex animate-pop items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-semibold ${s.tone}`}>
          <Icon size={22} variant="bulk" />
          {loading && view.state !== "red_flags" ? "Checking official sources" : s.title}
          {loading ? <span className="ml-auto size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
        </p>
        {loading && view.state !== "red_flags" ? (
          <div className="mt-3 space-y-2">
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        ) : (
          <p className="mt-3 text-[0.8125rem] leading-5 text-ink-700">{view.headline}</p>
        )}
        {signals.length ? (
          <ul className="mt-3 space-y-2.5">
            {signals.map((sig) => {
              const si = SIGNAL_ICON[sig.severity];
              const SI = si.icon;
              return (
                <li key={`${sig.id}-${sig.text}`} className="flex animate-rise items-start gap-2.5 text-[0.8125rem] leading-5 text-ink-700">
                  <SI size={18} variant="bulk" className={`mt-px shrink-0 ${si.cls}`} />
                  <span className="min-w-0">
                    {sig.text}
                    {sig.evidence ? <span className="mt-0.5 block text-xs italic text-ink-500">&ldquo;{sig.evidence}&rdquo;</span> : null}
                    {sig.sourceUrl ? (
                      <a href={sig.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex items-center gap-1 break-all text-xs font-medium text-brand-700 hover:underline">
                        {new URL(sig.sourceUrl).hostname.replace(/^www\./, "")}
                        <ExportSquare size={12} />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {failed && !loading ? <p className="mt-3 text-xs text-ink-500">The live check couldn&apos;t finish. The checks above still apply.</p> : null}
        <p className="mt-4 border-t border-ink-100 pt-3 text-xs leading-5 text-ink-500">We describe what we found. We can&apos;t prove a job is real, so never pay to apply or share your BVN.</p>
      </div>
    </section>
  );
}
