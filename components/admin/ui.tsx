import type { ReactNode } from "react";
import { TickCircle, Warning2, MinusCircle, Danger } from "@/components/icons";

// Back office headings use Title Case, with short joining words kept small (founder's
// rule: and, of, or, the, you, your; plus the usual a, an, to, in, on, for, by, at). Emails and
// paths are left exactly as written.
const SMALL = new Set(["and", "of", "or", "the", "a", "an", "to", "in", "on", "for", "by", "at", "you", "your"]);
export function titleCase(text: string): string {
  if (/[@/]/.test(text)) return text;
  return text
    .split(" ")
    .map((word, i) => (i > 0 && SMALL.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function PageHeader({ title, intro, action }: { title: string; intro?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div>
        <h1 className="font-display text-[1.625rem] font-semibold leading-8 tracking-[-0.03em] text-ink-900 [overflow-wrap:anywhere]">{titleCase(title)}</h1>
        {intro ? <p className="mt-0.5 max-w-3xl text-[0.9375rem] leading-6 text-ink-600">{intro}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Panel({ title, children, action, className = "" }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card ${className}`}>
      {title ? (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ink-100 px-4 py-2">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">{titleCase(title)}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Semantic table that scrolls sideways on phones instead of breaking the page. */
export function Table({ head, children, caption }: { head: string[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/70 text-xs font-medium text-ink-500">
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-2 font-medium">
                {titleCase(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 text-ink-800">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-middle ${className}`}>{children}</td>;
}

const STATUS = {
  good: { cls: "bg-proof-50 text-proof-700", icon: TickCircle, word: "On track" },
  warn: { cls: "bg-care-50 text-care-700", icon: Warning2, word: "Below target" },
  bad: { cls: "bg-flag-50 text-flag-700", icon: Danger, word: "Needs action" },
  none: { cls: "bg-ink-100 text-ink-600", icon: MinusCircle, word: "No data yet" },
} as const;

export function StatusPill({ status, label }: { status: keyof typeof STATUS; label?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <Icon size={14} variant="bulk" />
      {label ?? s.word}
    </span>
  );
}

export function KpiCard({ label, value, target, status, note, how }: { label: string; value: string; target: string; status: keyof typeof STATUS; note: string; how?: string }) {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-ink-150 bg-white p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8125rem] leading-5 text-ink-500">{titleCase(label)}</p>
        <StatusPill status={status} />
      </div>
      <p className={`mt-2 font-display font-semibold tracking-[-0.02em] text-ink-900 ${value.length > 10 ? "text-base" : "text-[1.75rem] leading-9"}`}>{value}</p>
      <p className="mt-auto pt-2 text-xs leading-5 text-ink-500">
        Target: {target}
        <span className="block">{note}</span>
      </p>
      {how ? (
        <details className="group mt-2 border-t border-ink-100 pt-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-brand-700 marker:hidden hover:underline">How it&apos;s counted</summary>
          <p className="mt-1 text-xs leading-5 text-ink-600">{how}</p>
        </details>
      ) : null}
    </div>
  );
}
