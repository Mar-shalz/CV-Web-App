"use client";

import { useState } from "react";
import { toggleLogistic } from "@/app/(app)/applications/[id]/shortlist/actions";
import { TickCircle } from "@/components/icons";

/** Logistics checklist (screen 21). Ticks save in the background. */
export function Logistics({ applicationId, items, done }: { applicationId: string; items: string[]; done: number[] }) {
  const [ticked, setTicked] = useState(new Set(done));
  const pct = Math.round((ticked.size / Math.max(1, items.length)) * 100);
  const r = 18;
  const c = 2 * Math.PI * r;

  function toggle(i: number, on: boolean) {
    setTicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(i);
      else next.delete(i);
      return next;
    });
    void toggleLogistic(applicationId, i, on);
  }

  return (
    <section aria-labelledby="logistics-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="logistics-title" className="text-[0.9375rem] font-semibold text-ink-900">
            For the day
          </h2>
          <p className="text-[0.8125rem] text-ink-500">
            {ticked.size} of {items.length} ready
          </p>
        </div>
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" className="-rotate-90">
          <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth="5" />
          <circle cx="22" cy="22" r={r} fill="none" stroke={pct === 100 ? "var(--color-proof-500)" : "var(--color-brand-500)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-500" />
        </svg>
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((item, i) => {
          const on = ticked.has(i);
          return (
            <li key={item}>
              <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 text-sm text-ink-800 hover:bg-ink-50">
                <input type="checkbox" checked={on} onChange={(e) => toggle(i, e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-600" />
                <span className={on ? "text-ink-500 line-through" : ""}>{item}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {pct === 100 ? (
        <p className="mt-2 flex animate-pop items-center gap-2 rounded-xl bg-proof-50 px-3 py-2.5 text-sm font-medium text-proof-700" role="status">
          <TickCircle size={18} variant="bulk" />
          All set. You&apos;ve got this.
        </p>
      ) : null}
    </section>
  );
}
