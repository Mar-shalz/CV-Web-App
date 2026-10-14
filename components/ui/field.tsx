import type { ComponentProps, ReactNode } from "react";
import { Danger } from "@/components/icons";

// Filled inputs, as in the reference: soft grey well, white with a blue ring on focus.
export const inputClass =
  "block w-full min-h-14 rounded-2xl border border-transparent bg-ink-75 px-4 text-base text-ink-900 placeholder:text-ink-400 placeholder:font-normal transition-[background-color,border-color,box-shadow] duration-200 hover:bg-ink-100 focus:border-brand-500 focus:bg-white focus:shadow-[0_0_0_4px_rgb(52_97_240/0.14)] focus:outline-none aria-[invalid=true]:border-flag-600 aria-[invalid=true]:bg-flag-50/40";

export function Field({
  id,
  label,
  hint,
  error,
  children,
  optional,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-ink-900">
        {label}
        {optional ? <span className="text-xs font-medium text-ink-500">Optional</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] leading-5 text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex animate-rise items-start gap-1.5 text-[0.8125rem] font-medium leading-5 text-flag-700">
      <Danger size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function TextInput({ invalid, describedBy, className = "", ...props }: ComponentProps<"input"> & { invalid?: boolean; describedBy?: string }) {
  return <input className={`${inputClass} ${className}`} aria-invalid={invalid || undefined} aria-describedby={describedBy} {...props} />;
}
