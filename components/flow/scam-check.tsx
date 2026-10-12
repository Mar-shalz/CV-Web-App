"use client";

import { useEffect, useState } from "react";
import { ShieldSearch, ShieldTick, TickCircle, Danger, Warning2 } from "@/components/icons";

type Signal = { ok: boolean; text: string; source: string | null };

const STATE = {
  verified: { tone: "bg-proof-50 text-proof-700", icon: ShieldTick, title: "Verified on an official channel" },
  unverified: { tone: "bg-care-50 text-care-700", icon: Warning2, title: "Couldn't verify. Be careful." },
  red_flags: { tone: "bg-flag-50 text-flag-700", icon: Danger, title: "Red flags found" },
} as const;

/** The live check streams in after the instant rule checks. In the preview the stream is simulated. */
export function ScamCheck({ state, headline, signals }: { state: keyof typeof STATE; headline: string; signals: Signal[] }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1800);
    return () => clearTimeout(t);
  }, []);
  const s = STATE[state];
  const Icon = s.icon;

  return (
    <section aria-labelledby="scam-title" aria-busy={loading} className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <h2 id="scam-title" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-900">
        <ShieldSearch size={20} variant="bulk" className="text-brand-600" />
        Is this job genuine?
      </h2>
      <div aria-live="polite">
        {loading ? (
          <div className="mt-4 space-y-3">
            <p className="flex items-center gap-2 text-sm text-ink-600">
              <span className="size-4 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" aria-hidden="true" />
              Checking official sources
            </p>
            <div className="skeleton h-12" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-3/5" />
          </div>
        ) : (
          <div className="animate-pop">
            <p className={`mt-4 flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-semibold ${s.tone}`}>
              <Icon size={22} variant="bulk" />
              {s.title}
            </p>
            <p className="mt-3 text-[0.8125rem] leading-5 text-ink-600">{headline}</p>
            <ul className="mt-3 space-y-2.5">
              {signals.map((sig) => (
                <li key={sig.text} className="flex items-start gap-2.5 text-[0.8125rem] leading-5 text-ink-700">
                  {sig.ok ? <TickCircle size={18} variant="bulk" className="mt-px shrink-0 text-proof-600" /> : <Warning2 size={18} variant="bulk" className="mt-px shrink-0 text-care-600" />}
                  <span>
                    {sig.text}
                    {sig.source ? <span className="block text-xs text-ink-500">Source: {sig.source}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-ink-100 pt-3 text-xs leading-5 text-ink-500">
              We describe what we found. We can&apos;t prove a job is real, so never pay to apply or share your BVN.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
