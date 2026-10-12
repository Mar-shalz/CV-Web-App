"use client";

import { useActionState, useState } from "react";
import { addMember, markRefunded, type AdminActionState } from "@/app/admin/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { inputClass } from "@/components/ui/field";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/permissions";

function Result({ state }: { state: AdminActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-xs font-medium ${state.error ? "text-flag-700" : "text-proof-700"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

/** Refunds happen in the Paystack dashboard first; this only records them. */
export function RefundForm({ passId, reference }: { passId: string; reference: string }) {
  const [state, action] = useActionState<AdminActionState, FormData>(markRefunded, undefined);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
        Record refund
      </button>
    );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="pass_id" value={passId} />
      <label className="flex items-start gap-2 text-xs leading-5 text-ink-700">
        <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-brand-600" />
        I refunded {reference} in Paystack
      </label>
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Saving">
          Mark refunded
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-3 text-sm text-ink-600 hover:bg-ink-75">
          Cancel
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function AddMemberForm() {
  const [state, action] = useActionState<AdminActionState, FormData>(addMember, undefined);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && Boolean(role);
  return (
    <form action={action} className="space-y-4 p-5">
      <div>
        <label htmlFor="m-email" className="text-sm font-semibold text-ink-900">
          Their account email
        </label>
        <input id="m-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-2`} placeholder="name@company.com" />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink-900">Role</legend>
        <div className="mt-2 grid gap-2">
          {ADMIN_ROLES.map((r) => (
            <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm ${role === r ? "border-brand-500 bg-brand-50/70" : "border-transparent bg-ink-75"}`}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-brand-600" />
              <span>
                <span className="block font-semibold text-ink-900">{ROLE_LABELS[r].label}</span>
                <span className="text-xs text-ink-600">{ROLE_LABELS[r].body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton className="w-full" pendingLabel="Adding" inactive={!ready}>
        Add to the team
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}
