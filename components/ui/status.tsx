import type { ReactNode } from "react";
import { Warning2, TickCircle, Clock, Danger, MinusCircle } from "@/components/icons";

// Status is never colour alone: every badge carries an icon and a word.
export type Tone = "proof" | "care" | "flag" | "neutral" | "brand";

const toneClass: Record<Tone, string> = {
  proof: "bg-proof-50 text-proof-700",
  care: "bg-care-50 text-care-700",
  flag: "bg-flag-50 text-flag-700",
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-50 text-brand-700",
};

const toneIcon: Record<Tone, ReactNode> = {
  proof: <TickCircle size={16} variant="bulk" />,
  care: <Warning2 size={16} variant="bulk" />,
  flag: <Danger size={16} variant="bulk" />,
  neutral: <MinusCircle size={16} variant="bulk" />,
  brand: <Clock size={16} variant="bulk" />,
};

export function Badge({ tone, children, icon, size = "md" }: { tone: Tone; children: ReactNode; icon?: ReactNode; size?: "md" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${toneClass[tone]} ${
        size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-[0.8125rem]"
      }`}
    >
      {icon ?? toneIcon[tone]}
      {children}
    </span>
  );
}
