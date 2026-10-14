"use client";

import { useState, useTransition } from "react";
import { deleteApplication } from "@/app/(app)/applications/[id]/actions";
import { Trash } from "@/components/icons";

/** Delete with one more tap to confirm. Gone for good, file included. */
export function DeleteApplication({ applicationId }: { applicationId: string }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-ink-500 transition-colors hover:bg-flag-50 hover:text-flag-700">
        <Trash size={18} />
        Delete this application
      </button>
    );
  }
  return (
    <div role="alert" className="animate-rise rounded-[var(--radius-card)] border border-flag-100 bg-flag-50 p-4">
      <p className="text-sm font-semibold text-flag-700">Delete this application?</p>
      <p className="mt-1 text-[0.8125rem] leading-5 text-flag-700/90">Its record, check ins, interview prep and any CV file you added here are deleted for good. Your experience stays.</p>
      {error ? <p className="mt-2 text-[0.8125rem] font-medium text-flag-700">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const res = await deleteApplication(applicationId);
              if (res && !res.ok) setError(res.error);
            })
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-flag-600 px-4 text-sm font-semibold text-white hover:bg-flag-700 disabled:opacity-70"
        >
          {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : <Trash size={18} />}
          {busy ? "Deleting" : "Delete for good"}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={busy} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-ink-700">
          Keep it
        </button>
      </div>
    </div>
  );
}
