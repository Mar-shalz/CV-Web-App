import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";

/** Honest placeholder for a screen whose build slice hasn't started yet. */
export function ComingNext({ title, intro, slice, points, icon }: { title: string; intro: string; slice: string; points: string[]; icon: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-[1.625rem] font-bold leading-8 tracking-[-0.02em] text-ink-900 lg:text-[2rem] lg:leading-10">{title}</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">{intro}</p>
      </header>
      <section className="torn-edge rounded-t-[var(--radius-card)] bg-paper p-5 shadow-card lg:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span>
          <p className="text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-ink-500">Being built · {slice}</p>
        </div>
        <ul className="mt-4 space-y-2.5 border-t border-dashed border-paper-edge pt-4 text-[0.9375rem] leading-6 text-ink-800">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </section>
      <ButtonLink href="/home" variant="secondary">
        Back to Home
      </ButtonLink>
    </div>
  );
}
