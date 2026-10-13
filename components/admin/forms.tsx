"use client";

import { useActionState, useState } from "react";
import { addMember, grantFreeAccess, markRefunded, sendUpdate, type AdminActionState } from "@/app/admin/actions";
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

const AUDIENCES = [
  { id: "everyone", label: "Everyone" },
  { id: "trial", label: "People on the free trial" },
  { id: "pass", label: "People with a pass" },
  { id: "no_pass", label: "People without a pass" },
  { id: "person", label: "One person" },
] as const;

/** Sends to the Updates panel behind the bell. Shows a preview of what people will see. */
export function SendUpdateForm() {
  const [state, action] = useActionState<AdminActionState, FormData>(sendUpdate, undefined);
  const [to, setTo] = useState<string>("everyone");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const ready = title.trim().length >= 3 && body.trim().length >= 3;
  return (
    <form action={action} className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold text-ink-900">Who gets it</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <label key={a.id} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium ring-1 ${to === a.id ? "bg-brand-900 text-white ring-brand-900" : "bg-white text-ink-700 ring-ink-150 hover:bg-ink-50"}`}>
                <input type="radio" name="to" value={a.id} checked={to === a.id} onChange={() => setTo(a.id)} className="sr-only" />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>
        {to === "person" ? (
          <div>
            <label htmlFor="u-email" className="text-sm font-semibold text-ink-900">
              Their account email
            </label>
            <input id="u-email" name="email" type="email" className={`${inputClass} mt-2`} placeholder="name@gmail.com" />
          </div>
        ) : null}
        <div>
          <label htmlFor="u-title" className="text-sm font-semibold text-ink-900">
            Title
          </label>
          <input id="u-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${inputClass} mt-2`} placeholder="Graduate programme season is here" />
        </div>
        <div>
          <label htmlFor="u-body" className="flex justify-between text-sm font-semibold text-ink-900">
            Message
            <span className="text-xs font-normal text-ink-500">{body.length}/600</span>
          </label>
          <textarea id="u-body" name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} rows={4} className={`${inputClass} mt-2 py-3`} placeholder="Plain words, one idea. Say what to do next." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="u-link" className="text-sm font-semibold text-ink-900">
              Link in the app <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input id="u-link" name="link" className={`${inputClass} mt-2`} placeholder="/pass" />
          </div>
          {to !== "person" ? (
            <div>
              <label htmlFor="u-days" className="text-sm font-semibold text-ink-900">
                Show for <span className="font-normal text-ink-500">(days, optional)</span>
              </label>
              <input id="u-days" name="days" type="number" min={1} max={90} className={`${inputClass} mt-2`} placeholder="Until you end it" />
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Sending" inactive={!ready}>
            Send
          </SubmitButton>
          <Result state={state} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">What they&apos;ll see</p>
        <div className="mt-2 rounded-2xl border border-ink-150 bg-white p-4 shadow-card">
          <p className="text-xs font-medium text-ink-500">{to === "person" ? "Message for you" : "From the team"}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-900">{title || "Your title"}</p>
          <p className="mt-0.5 whitespace-pre-line text-[0.8125rem] leading-5 text-ink-600">{body || "Your message shows here."}</p>
        </div>
      </div>
    </form>
  );
}

/** Free access for family and testers: full use of the app, no payment. */
export function FreeAccessForm() {
  const [state, action] = useActionState<AdminActionState, FormData>(grantFreeAccess, undefined);
  const [email, setEmail] = useState("");
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  return (
    <form action={action} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
      <div>
        <label htmlFor="fa-email" className="text-sm font-semibold text-ink-900">
          Their email
        </label>
        <input id="fa-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-2`} placeholder="the email they sign in with" />
      </div>
      <div>
        <label htmlFor="fa-days" className="text-sm font-semibold text-ink-900">
          For how long
        </label>
        <select id="fa-days" name="days" defaultValue="90" className={`${inputClass} mt-2`}>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
          <option value="forever">Until I remove it</option>
        </select>
      </div>
      <div>
        <label htmlFor="fa-note" className="text-sm font-semibold text-ink-900">
          Note <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input id="fa-note" name="note" maxLength={120} className={`${inputClass} mt-2`} placeholder="Family, tester…" />
      </div>
      <SubmitButton pendingLabel="Saving" inactive={!ready}>
        Give free access
      </SubmitButton>
      <div className="md:col-span-4">
        <Result state={state} />
      </div>
    </form>
  );
}
