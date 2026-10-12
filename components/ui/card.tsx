import type { ReactNode } from "react";

export function Card({ children, className = "", as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" } & Record<string, unknown>) {
  return (
    <As className={`rounded-[var(--radius-card)] border border-ink-200/70 bg-white shadow-card ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5">
      <h2 id={id} className="font-display text-[1.0625rem] font-bold tracking-[-0.01em] text-ink-900">
        {title}
      </h2>
      {action}
    </div>
  );
}
