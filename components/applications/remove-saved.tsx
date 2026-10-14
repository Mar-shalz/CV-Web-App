"use client";

import { useState, useTransition } from "react";
import { removeSavedJob } from "@/app/(app)/jobs/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash } from "@/components/icons";

/** Removes a saved job straight from the list or its check page, with one confirm (D-130). */
export function RemoveSaved({ jobId, title, variant = "icon" }: { jobId: string; title: string; variant?: "icon" | "button" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={variant === "icon" ? `Remove ${title} from saved jobs` : undefined}
        className={
          variant === "icon"
            ? "grid size-11 shrink-0 place-items-center rounded-xl text-ink-400 transition-colors hover:bg-flag-50 hover:text-flag-700"
            : "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-ink-600 transition-colors hover:bg-flag-50 hover:text-flag-700"
        }
      >
        <Trash size={variant === "icon" ? 19 : 18} />
        {variant === "button" ? "Remove from saved" : null}
      </button>
      <ConfirmDialog
        open={open}
        title="Remove this saved job?"
        confirmLabel="Remove"
        busyLabel="Removing"
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await removeSavedJob(jobId);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        <p>
          <span className="font-semibold text-ink-900">{title}</span> comes off your saved jobs. You can add it again any time from the advert.
        </p>
      </ConfirmDialog>
    </>
  );
}
