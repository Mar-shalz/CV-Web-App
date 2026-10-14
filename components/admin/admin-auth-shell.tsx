import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ShieldTick, Lock1, DocumentText } from "@/components/icons";

const POINTS = [
  { icon: ShieldTick, text: "Staff only. Two factor sign in every time." },
  { icon: DocumentText, text: "Every change you make is written to the audit log." },
  { icon: Lock1, text: "People's CVs and job posts stay private, even from staff." },
] as const;

/**
 * The back office's own sign in screen (D-127): dark, plainly staff only, and separate
 * from the app's sign in, with no onboarding steps. It signs in to the same account
 * system, so a team member signed in here is also signed in to the app, and the other
 * way round, with nothing to do twice.
 */
export function AdminAuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f3f5fa] p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-6 lg:p-6">
      <aside className="relative flex flex-col overflow-hidden rounded-[24px] bg-brand-950 px-5 pb-6 pt-5 text-white lg:h-[min(960px,calc(100dvh-3rem))] lg:min-h-[560px] lg:rounded-[28px] lg:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand-600/25 blur-3xl" />
        <Logo tone="onDark" />
        <div className="mt-6 lg:mt-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Back Office</p>
          <p className="mt-2 max-w-sm font-display text-2xl font-semibold leading-8 tracking-[-0.02em] lg:text-[2rem] lg:leading-10">Run the service. Keep people&apos;s data safe.</p>
          <ul className="mt-6 hidden space-y-3 lg:block">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-sky-300">
                  <Icon size={18} variant="bulk" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      {/* A white card, so the grey fields stand out from the page. */}
      <main className="mx-auto mt-3 w-full max-w-md rounded-[24px] bg-white p-6 shadow-card lg:mt-0 lg:p-8">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900">{title}</h1>
        {subtitle ? <div className="mt-2 text-[0.9375rem] leading-6 text-ink-600">{subtitle}</div> : null}
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}
