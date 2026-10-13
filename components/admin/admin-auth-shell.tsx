import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ShieldTick, ArrowLeft } from "@/components/icons";

/** Sign in for staff: dark back office colours, one card, nothing else on the page. */
export function AdminAuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main id="main" className="aurora relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="aurora-floor" aria-hidden="true" />
      <div className="relative w-full max-w-[460px]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Logo tone="onDark" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">
            <ShieldTick size={14} variant="bulk" />
            Back office
          </span>
        </div>
        <section className="animate-rise rounded-[var(--radius-panel)] bg-white p-6 shadow-[0_32px_64px_-32px_rgb(11_24_56/0.7)] lg:p-8">
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900">{title}</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-6 text-ink-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>
        <p className="mt-6 text-center">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white/75 hover:text-white">
            <ArrowLeft size={18} />
            Not staff? Go to the app
          </Link>
        </p>
      </div>
    </main>
  );
}
