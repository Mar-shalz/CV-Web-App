import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition-[background-color,color,box-shadow,transform,border-color] duration-200 active:scale-[0.98] " +
  // Inactive state (D-019): grey fill and muted text, not just faded. Same look for
  // disabled and aria-disabled, so a not-ready form still explains itself when tapped.
  "disabled:cursor-not-allowed disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[var(--shadow-cta)] hover:bg-brand-700 active:bg-brand-800 " +
    "disabled:bg-ink-150 disabled:text-ink-500 disabled:shadow-none aria-disabled:bg-ink-150 aria-disabled:text-ink-500 aria-disabled:shadow-none",
  secondary:
    "border border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50 " +
    "disabled:border-ink-150 disabled:bg-ink-75 disabled:text-ink-400 aria-disabled:border-ink-150 aria-disabled:bg-ink-75 aria-disabled:text-ink-400",
  ghost: "text-brand-700 hover:bg-brand-50 disabled:text-ink-400 aria-disabled:text-ink-400",
  danger:
    "border border-flag-600/30 bg-white text-flag-700 hover:bg-flag-50 disabled:text-ink-400 aria-disabled:text-ink-400",
  light: "bg-white text-brand-800 shadow-[0_10px_24px_-12px_rgb(11_24_56/0.5)] hover:bg-brand-50",
};

// 48px minimum tap target on every size (WCAG 2.5.8 and the Build pack's 48px rule).
const sizes: Record<Size, string> = {
  sm: "min-h-12 px-4 text-sm",
  md: "min-h-12 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-6 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
