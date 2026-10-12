import type { CSSProperties, ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";

const tints = {
  brand: "bg-brand-50 text-brand-700",
  proof: "bg-proof-50 text-proof-700",
  care: "bg-care-50 text-care-700",
  sky: "bg-sky-200/50 text-brand-800",
} as const;

export function StatCard({ label, value, icon, tint, hint, i = 0 }: { label: string; value: number; icon: ReactNode; tint: keyof typeof tints; hint?: string; i?: number }) {
  return (
    <div style={{ "--i": i } as CSSProperties} className="flex h-full flex-col items-start gap-2.5 rounded-xl border border-ink-150 bg-white p-3.5 shadow-card sm:flex-row sm:items-center sm:gap-3 lg:gap-3.5 lg:p-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-10 lg:size-11 ${tints[tint]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.8125rem] leading-5 text-ink-500 sm:truncate">{label}</p>
        <p className="font-display text-[1.5rem] font-semibold leading-8 tracking-[-0.02em] text-ink-900">
          <CountUp value={value} />
        </p>
        {hint ? <p className="hidden truncate text-xs text-ink-500 sm:block">{hint}</p> : null}
      </div>
    </div>
  );
}
