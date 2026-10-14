"use client";

import { useState, useTransition } from "react";
import { deleteApplication } from "@/app/(app)/applications/[id]/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash } from "@/components/icons";

/** Delete, confirmed in a small window. Gone for good, file included; the back office keeps only the count. */
export function DeleteApplication({ applicationId, title }: { applicationId: string; title: string }) {
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
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl bg-flag-50 px-4 text-sm font-semibold text-flag-700 ring-1 ring-flag-100 transition-colors hover:bg-flag-100 active:scale-[0.98]"
      >
        <Trash size={18} />
        Delete application
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this application?"
        confirmLabel="Delete for good"
        busyLabel="Deleting"
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deleteApplication(applicationId);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        <p>
          <span className="font-semibold text-ink-900">{title}</span> and its check ins, interview prep and any CV file you added here are deleted for good. Your experience stays.
        </p>
      </ConfirmDialog>
    </>
  );
}
