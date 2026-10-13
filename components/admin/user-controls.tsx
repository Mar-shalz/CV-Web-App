"use client";

import { useActionState, useState } from "react";
import { deleteUserAccount, restoreUser, suspendUser, type AdminActionState } from "@/app/admin/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { PendingButton } from "@/components/ui/pending-button";
import { inputClass } from "@/components/ui/field";
import { Danger, Lock1, Trash, TickCircle } from "@/components/icons";

function Notice({ state }: { state: AdminActionState }) {
  if (!state) return null;
  return state.error ? (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-flag-50 p-3 text-sm text-flag-700">
      <Danger size={18} className="mt-px shrink-0" />
      {state.error}
    </p>
  ) : state.ok ? (
    <p role="status" className="flex items-center gap-2 rounded-xl bg-proof-50 p-3 text-sm font-medium text-proof-700">
      <TickCircle size={18} variant="bulk" />
      {state.ok}
    </p>
  ) : null;
}

/** Pause or restore. Pausing asks for an optional reason, kept for the team only. */
export function SuspendControl({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action] = useActionState<AdminActionState, FormData>(suspendUser, undefined);
  const [open, setOpen] = useState(false);

  if (suspended) {
    return (
      <form action={restoreUser} className="space-y-2">
        <input type="hidden" name="user_id" value={userId} />
        <p className="text-sm leading-6 text-ink-600">They see a &ldquo;paused&rdquo; page and can&apos;t sign in. Restore lets them back in with everything as it was.</p>
        <PendingButton pendingLabel="Restoring" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-proof-600 px-5 text-sm font-semibold text-white hover:bg-proof-700">
          <TickCircle size={18} variant="bulk" />
          Restore account
        </PendingButton>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-ink-600">Pausing signs them out and stops them using the app. Nothing is deleted, and you can restore it any time.</p>
      {open ? (
        <form action={action} className="animate-rise space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <Notice state={state} />
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-ink-900">
              Reason <span className="font-normal text-ink-500">(optional, only the team sees it)</span>
            </span>
            <input name="reason" maxLength={200} className={inputClass} placeholder="For example: one account shared by several people" />
          </label>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Pausing" className="bg-care-600! hover:bg-care-700!">
              <Lock1 size={18} />
              Pause account
            </SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-2xl px-4 text-sm font-semibold text-ink-700 hover:bg-ink-75">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <Notice state={state} />
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-care-600/30 bg-white px-5 text-sm font-semibold text-care-700 transition-colors hover:bg-care-50 active:scale-[0.98]">
            <Lock1 size={18} />
            Pause account
          </button>
        </>
      )}
    </div>
  );
}

/** Delete for good. The owner types the person's email, so it can't happen by a slip. */
export function DeleteControl({ userId, email }: { userId: string; email: string }) {
  const [state, action] = useActionState<AdminActionState, FormData>(deleteUserAccount, undefined);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const match = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-ink-600">Deletes the account, their experience, CVs, applications, payments record and files. This can&apos;t be undone. Paystack keeps its own payment records.</p>
      {open ? (
        <form action={action} className="animate-rise space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <Notice state={state} />
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-ink-900">
              Type <span className="font-mono text-flag-700">{email}</span> to confirm
            </span>
            <input name="confirm_email" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={inputClass} />
          </label>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Deleting" inactive={!match} className="bg-flag-600! hover:bg-flag-700! aria-disabled:bg-ink-150!">
              <Trash size={18} />
              Delete for good
            </SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-2xl px-4 text-sm font-semibold text-ink-700 hover:bg-ink-75">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-flag-600/30 bg-white px-5 text-sm font-semibold text-flag-700 transition-colors hover:bg-flag-50 active:scale-[0.98]">
          <Trash size={18} />
          Delete account
        </button>
      )}
    </div>
  );
}
