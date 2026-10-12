"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

/**
 * Submit button with three states: ready, inactive (form not complete yet) and busy.
 * Inactive uses aria-disabled rather than disabled, so the button stays focusable
 * and a tap explains what is missing instead of doing nothing.
 */
export function SubmitButton({
  children,
  pendingLabel,
  inactive = false,
  onInactiveClick,
  ...props
}: ComponentProps<typeof Button> & {
  pendingLabel: string;
  children: ReactNode;
  inactive?: boolean;
  onInactiveClick?: () => void;
}) {
  const { pending } = useFormStatus();
  function onClick(e: MouseEvent<HTMLButtonElement>) {
    if (inactive || pending) {
      e.preventDefault();
      if (inactive) onInactiveClick?.();
    }
  }
  return (
    <Button type="submit" aria-disabled={inactive || pending || undefined} aria-busy={pending || undefined} onClick={onClick} {...props}>
      {pending ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
