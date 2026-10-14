"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Danger } from "@/components/icons";
import { Spinner } from "./pending-button";

/**
 * A small "are you sure?" window for actions that can't be undone (D-120). Native
 * dialog: focus stays inside, Escape or a tap outside cancels, and the safe choice
 * has focus first.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  busy = false,
  error,
  cancelLabel = "Keep it",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  error?: string | null;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="route-modal m-0 mt-auto w-full max-w-none rounded-t-[var(--radius-panel)] bg-white p-0 text-ink-900 shadow-raised backdrop:bg-ink-950/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:w-[calc(100%-3rem)] sm:max-w-md sm:rounded-[var(--radius-panel)]"
    >
      <div className="p-5 sm:p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-flag-50 text-flag-600">
          <Danger size={26} variant="bulk" />
        </span>
        <h2 id="confirm-title" className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink-900">
          {title}
        </h2>
        <div className="mt-2 text-[0.9375rem] leading-6 text-ink-600">{children}</div>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-flag-50 px-3 py-2 text-sm font-medium text-flag-700">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={onClose} disabled={busy} className="min-h-12 rounded-2xl bg-ink-75 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-100 disabled:opacity-60">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-flag-600 px-5 text-sm font-semibold text-white hover:bg-flag-700 active:scale-[0.98] disabled:cursor-progress disabled:opacity-80"
          >
            {busy ? <Spinner /> : null}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
