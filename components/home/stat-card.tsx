import type { CSSProperties, ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";

const tints = {
  brand: "bg-brand-50 text-brand-700",
  proof: "bg-proof-50 text-proof-700",
  care: "bg-care-50 text-care-700",
  sky: "bg-sky-200/50 text-brand-800",
} as const;

/** Overview number, laid out as the founder's sketch: label on top, icon bottom left, number and hint right. */
export function StatCard({ label, value, icon, tint, hint, i = 0 }: { label: string; value: number; icon: ReactNode; tint: keyof typeof tints; hint?: string; i?: number }) {
  return (
    <div style={{ "--i": i } as CSSProperties} className="flex h-full flex-col justify-between gap-3 rounded-xl border border-ink-150 bg-white p-3.5 shadow-card lg:p-4">
      <p className="text-[0.8125rem] font-medium leading-5 text-ink-700 sm:text-sm">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg lg:size-10 ${tints[tint]}`}>{icon}</span>
        <div className="min-w-0 text-right">
          <p className="font-display text-[1.625rem] font-semibold leading-8 tracking-[-0.02em] text-ink-900 lg:text-[1.75rem]">
            <CountUp value={value} />
          </p>
          {hint ? <p className="hidden text-[0.75rem] leading-4 text-ink-500 sm:block">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
