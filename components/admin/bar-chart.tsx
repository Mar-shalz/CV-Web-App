"use client";

import { useState } from "react";

/**
 * Single series daily bar chart. Thin bars rounded at the data end, anchored to a
 * zero baseline, recessive gridlines, a hover tooltip per bar, and a table view for
 * screen readers. One series, so no legend: the title names it.
 */
export function BarChart({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const nice = Math.ceil(max / 10) * 10;
  const ticks = [0, nice / 2, nice];
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

  return (
    <figure className="px-5 pb-5 pt-4">
      <div className="relative h-48" aria-hidden="true">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / nice) * 100}%` }}>
            <span className="w-7 -translate-y-1/2 text-right text-[0.6875rem] tabular-nums text-ink-400">{t}</span>
            <span className={`h-px flex-1 ${t === 0 ? "bg-ink-300" : "bg-ink-100"}`} />
          </div>
        ))}
        <div className="absolute inset-y-0 left-9 right-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <div
              key={d.date}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full max-w-7 rounded-t-[4px] transition-colors duration-150 ${hover === i ? "bg-brand-700" : "bg-brand-500"}`}
                style={{ height: `${(d.count / nice) * 100}%`, minHeight: d.count ? 2 : 0 }}
              />
              {hover === i ? (
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-xl bg-ink-900 px-3 py-2 text-xs text-white shadow-raised">
                  <span className="block text-white/70">{fmt(d.date)}</span>
                  <span className="font-semibold">
                    {d.count} {label}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-9 mt-2 flex justify-between text-[0.6875rem] text-ink-400" aria-hidden="true">
        <span>{fmt(data[0]?.date ?? new Date().toISOString())}</span>
        <span>{fmt(data[data.length - 1]?.date ?? new Date().toISOString())}</span>
      </div>
      {/* Screen reader table. The wrapper is visually hidden: a table ignores sr-only's
          1px size and would stretch the page below the content. */}
      <div className="sr-only">
        <table>
          <caption>{label} per day</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <th scope="row">{fmt(d.date)}</th>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
