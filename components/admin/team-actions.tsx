"use client";

import { useState } from "react";
import { deleteMember, pauseMember, reactivateMember } from "@/app/admin/actions";
import { PendingButton } from "@/components/ui/pending-button";

const btn = "min-h-10 rounded-xl px-3 text-sm font-semibold";

/** Pause, reactivate or delete a team member. Delete asks once more before it happens. */
export function TeamActions({ userId, status, who }: { userId: string; status: "active" | "paused" | "removed"; who: string }) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <form action={deleteMember} className="flex flex-wrap items-center justify-end gap-1.5">
        <input type="hidden" name="user_id" value={userId} />
        <span className="text-xs text-ink-600">Delete {who} from the team?</span>
        <PendingButton pendingLabel="Deleting" className={`${btn} bg-flag-600 text-white hover:bg-flag-700`}>
          Delete
        </PendingButton>
        <button type="button" onClick={() => setConfirm(false)} className={`${btn} text-ink-700 hover:bg-ink-75`}>
          Keep
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "active" ? (
        <form action={pauseMember}>
          <input type="hidden" name="user_id" value={userId} />
          <PendingButton pendingLabel="Pausing" className={`${btn} text-care-700 hover:bg-care-50`}>
            Pause
          </PendingButton>
        </form>
      ) : (
        <form action={reactivateMember}>
          <input type="hidden" name="user_id" value={userId} />
          <PendingButton pendingLabel="Reactivating" className={`${btn} text-proof-700 hover:bg-proof-50`}>
            Reactivate
          </PendingButton>
        </form>
      )}
      <button type="button" onClick={() => setConfirm(true)} className={`${btn} text-flag-700 hover:bg-flag-50`}>
        Delete
      </button>
    </div>
  );
}
