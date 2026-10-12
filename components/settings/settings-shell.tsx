import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft2 } from "@/components/icons";

export function SettingsShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/settings" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
        <ArrowLeft2 size={16} />
        Settings
      </Link>
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">{title}</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">{intro}</p>
      </header>
      {children}
    </div>
  );
}
