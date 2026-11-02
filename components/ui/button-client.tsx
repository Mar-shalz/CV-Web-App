"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useLinkStatus } from "next/link";
import { buttonClass, type ButtonVariant, type Size } from "./button-styles";

/**
 * The rolling state (founder round 39, D-210). The button that was pressed shows a spinner
 * in place of its label while the work it started runs, at the same size and in its own
 * colour. Other buttons waiting on the same work only go inactive. `pending` is that work
 * (a transition, say); a submit button also rolls while its form is sending.
 */
export function usePressed(pending: boolean): [rolling: boolean, press: () => void] {
  const [pressed, setPressed] = useState(false);
  // Forget the press once the work is done, or soon after a press that started none.
  useEffect(() => {
    if (!pressed || pending) return;
    const t = setTimeout(() => setPressed(false), 300);
    return () => clearTimeout(t);
  }, [pressed, pending]);
  return [pressed && pending, () => setPressed(true)];
}

/** The label, hidden but keeping its space, under a spinner. `late`: only after 120ms, so a quick page change doesn't flash. */
export function Rolling({ busy, late = false, size = "md", children }: { busy: boolean; late?: boolean; size?: Size; children: ReactNode }) {
  if (!busy) return <>{children}</>;
  return (
    <span className={`grid ${late ? "rolling-late" : ""}`}>
      <span className={`rolling-label col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${late ? "" : "invisible"}`}>{children}</span>
      <span aria-hidden="true" className="rolling-spin col-start-1 row-start-1 place-self-center">
        <span className={`block animate-spin rounded-full border-2 border-current border-r-transparent ${size === "sm" ? "size-4" : "size-5"}`} />
      </span>
    </span>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  pending = false,
  disabled,
  onClick,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: Size; pending?: boolean }) {
  const form = useFormStatus();
  const [rolling, press] = usePressed(pending);
  const busy = rolling || (form.pending && props.type !== "button");
  return (
    <button
      {...props}
      className={buttonClass(variant, size, `${busy ? "pointer-events-none" : ""} ${className}`)}
      // The pressed button keeps its colour while it rolls; a second press does nothing.
      disabled={busy ? undefined : disabled}
      aria-busy={busy || undefined}
      onClick={(e) => {
        if (busy) return e.preventDefault();
        press();
        onClick?.(e);
      }}
    >
      <Rolling busy={busy} size={size}>
        {children}
      </Rolling>
    </button>
  );
}

/** Inside a ButtonLink: rolls while the page it opens is loading. */
export function LinkBody({ size, children }: { size?: Size; children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <Rolling busy={pending} late size={size}>
      {children}
    </Rolling>
  );
}
