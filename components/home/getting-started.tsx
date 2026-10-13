import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, TickCircle, Briefcase, Magicpen, Send2, Lock1 } from "@/components/icons";

const STEPS = [
  { href: "/vault", icon: Briefcase, title: "Add your experience", body: "Upload your old CV, even a photo of it, or answer a few quick questions." },
  { href: "/jobs/new", icon: Magicpen, title: "Tailor your CV to a job", body: "Add a job description. We check if you qualify, then rewrite your CV to match." },
  { href: "/applications", icon: Send2, title: "Send your application", body: "We prepare the CV and the exact email. You send it from your own phone." },
];

export function GettingStarted({ doneUpTo }: { doneUpTo: number }) {
  return (
    <section aria-labelledby="start-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
      <h2 id="start-title" className="text-lg font-semibold text-ink-900">
        Get set up in about 8 minutes
      </h2>
      <ol className="stagger mt-4 grid gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => {
          const done = i < doneUpTo;
          const current = i === doneUpTo;
          // One step at a time: a later step opens only when the one before it is done.
          const locked = i > doneUpTo;
          const Icon = s.icon;
          const cls = `flex h-full flex-col rounded-[18px] border p-4 ${
            current ? "lift border-brand-600 bg-brand-600 text-white shadow-raised" : locked ? "cursor-not-allowed border-dashed border-ink-200 bg-ink-50/60" : "lift border-ink-150 bg-ink-50/60 hover:border-ink-300"
          }`;
          const inner = (
            <>
              <span className="flex items-center justify-between">
                <span className={`grid size-11 place-items-center rounded-2xl ${current ? "bg-white/15" : done ? "bg-proof-50 text-proof-700" : locked ? "bg-ink-75 text-ink-400" : "bg-white text-ink-600"}`}>
                  {done ? <TickCircle size={22} variant="bulk" /> : locked ? <Lock1 size={20} /> : <Icon size={22} variant={current ? "bulk" : "linear"} />}
                </span>
                <span className={`text-xs font-medium ${current ? "text-white/80" : "text-ink-500"}`}>
                  Step {i + 1}
                  <span className="sr-only">{done ? ", done" : current ? ", up next" : ", locked"}</span>
                </span>
              </span>
              <span className={`mt-4 text-[0.9375rem] font-semibold ${current ? "" : locked ? "text-ink-500" : "text-ink-900"}`}>{s.title}</span>
              <span className={`mt-1 flex-1 text-[0.8125rem] leading-5 ${current ? "text-white/85" : locked ? "text-ink-400" : "text-ink-600"}`}>{s.body}</span>
              {current ? (
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
                  Start now
                  <ArrowRight size={16} />
                </span>
              ) : locked ? (
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                  <Lock1 size={14} />
                  Opens after step {i}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={s.title} style={{ "--i": i } as CSSProperties}>
              {locked ? (
                <div aria-disabled="true" className={cls}>
                  {inner}
                </div>
              ) : (
                <Link href={s.href} aria-current={current ? "step" : undefined} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
