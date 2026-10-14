"use client";

import { useEffect, useState } from "react";

/**
 * A clear "we're working on it" panel for the slow AI steps (D-106): a coloured band,
 * what is happening now, a running clock and an honest estimate. The steps move on a
 * timer because the server doesn't report progress; the clock is real.
 */
export function WorkingNotice({ title, steps, estimate = "Usually under a minute", stepSeconds = 6, compact = false }: { title: string; steps: string[]; estimate?: string; stepSeconds?: number; compact?: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const step = Math.min(Math.floor(seconds / stepSeconds), steps.length - 1);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const slow = seconds >= 60;

  return (
    <section role="status" aria-live="polite" aria-busy="true" className={`overflow-hidden rounded-[var(--radius-card)] border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-sky-50 shadow-card ${compact ? "p-4" : "p-5 lg:p-6"}`}>
      <div className="flex items-start gap-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-[var(--shadow-cta)]">
          <span className="size-6 animate-spin rounded-full border-[3px] border-white border-r-transparent" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-brand-700">Working on it</p>
          <h2 className="mt-0.5 text-lg font-semibold leading-6 text-ink-900">{title}</h2>
          <p key={step} className="mt-1 animate-rise text-[0.9375rem] text-brand-800">
            {steps[step]}
            <span className="animate-pulse">…</span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-brand-800 ring-1 ring-brand-100" aria-label={`${seconds} seconds so far`}>
          {clock}
        </span>
      </div>
      <ol className="mt-4 flex gap-1.5" aria-hidden="true">
        {steps.map((s, i) => (
          <li key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-brand-600" : "bg-brand-100"}`} />
        ))}
      </ol>
      <p className="mt-3 text-sm text-ink-600">{slow ? "Still working. When the AI is busy this can take up to 2 minutes. Keep this page open." : `${estimate}. Keep this page open.`}</p>
    </section>
  );
}
