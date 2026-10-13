"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span className={`${className} inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent`} aria-hidden="true" />;
}

/**
 * Submit button for small server forms (Remove, Publish, Confirm). While its form is
 * sending it shows a spinner and the pending label, and ignores extra taps. With
 * name and value, only the button that was tapped shows the spinner.
 */
export function PendingButton({
  children,
  pendingLabel,
  className = "",
  name,
  value,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { pendingLabel: string; children: ReactNode }) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  const layout = /(^|\s)(inline-)?flex(\s|$)/.test(className) ? "" : "inline-flex items-center justify-center gap-2";
  function onClick(e: MouseEvent<HTMLButtonElement>) {
    if (pending) e.preventDefault();
  }
  return (
    <button
      type="submit"
      name={name}
      value={value}
      aria-busy={mine || undefined}
      aria-disabled={pending || undefined}
      onClick={onClick}
      className={`${layout} ${className} transition-[background-color,color,transform,opacity] active:scale-[0.97] aria-disabled:cursor-progress ${pending && !mine ? "opacity-60" : ""}`}
      {...props}
    >
      {mine ? (
        <>
          <Spinner />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
