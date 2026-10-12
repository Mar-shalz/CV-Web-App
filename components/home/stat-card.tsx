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
    <div style={{ "--i": i } as CSSProperties} className="flex h-full items-center gap-4 rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card lg:p-5">
      <span className={`grid size-12 shrink-0 place-items-center rounded-2xl lg:size-14 ${tints[tint]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.8125rem] leading-5 text-ink-500">{label}</p>
        <p className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-ink-900">
          <CountUp value={value} />
        </p>
        {hint ? <p className="truncate text-xs text-ink-500">{hint}</p> : null}
      </div>
    </div>
  );
}
