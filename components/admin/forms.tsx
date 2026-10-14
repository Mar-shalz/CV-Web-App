"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { MessageDraft } from "@/lib/admin/messages";
import { addMember, findUsers, grantFreeAccess, markRefunded, sendUpdate, type AdminActionState, type UserHit } from "@/app/admin/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { inputClass } from "@/components/ui/field";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/permissions";
import { TickCircle } from "@/components/icons";

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
/**
 * "One person": type a name or email and pick from the people who match (D-132), so a
 * message can't go to a mistyped address. Keyboard: arrows to move, Enter to pick, Escape to close.
 */
function RecipientField({ email, setEmail, recipient, setRecipient, error }: { email: string; setEmail: (v: string) => void; recipient: UserHit | null; setRecipient: (u: UserHit | null) => void; error?: string }) {
  const [hits, setHits] = useState<UserHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    const q = email.trim();
    if (recipient || q.length < 2) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      const found = await findUsers(q).catch(() => []);
      if (n !== seq.current) return;
      setSearching(false);
      setHits(found);
      setActive(0);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [email, recipient]);

  const pick = (u: UserHit) => {
    setRecipient(u);
    setEmail(u.email);
    setOpen(false);
  };
  const showList = open && !recipient && email.trim().length >= 2;

  return (
    <div className="relative">
      <label htmlFor="u-email" className="text-sm font-semibold text-ink-900">
        Who <span className="font-normal text-ink-500">(type their name or email, then pick them)</span>
      </label>
      <input
        id="u-email"
        name="email"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "u-email-error" : undefined}
        autoComplete="off"
        spellCheck={false}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (recipient) setRecipient(null);
        }}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList || !hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const u = hits[active];
            if (u) pick(u);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={`${inputClass} mt-2 ${recipient ? "border-proof-600 bg-proof-50/40" : ""}`}
        placeholder="Start typing a name or email"
      />
      {recipient ? <input type="hidden" name="recipient_id" value={recipient.id} /> : null}
      {recipient ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-proof-700">
          <TickCircle size={14} variant="bulk" />
          {recipient.name ? `${recipient.name}, ` : ""}picked from your users
        </p>
      ) : null}
      {error ? (
        <p id="u-email-error" role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-flag-700">
          {error}
        </p>
      ) : null}
      {showList ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 z-30 mt-1.5 max-h-72 animate-pop overflow-y-auto rounded-2xl border border-ink-150 bg-white p-1.5 shadow-raised">
          {searching && !hits.length ? <li className="px-3 py-2.5 text-sm text-ink-500">Searching…</li> : null}
          {!searching && !hits.length ? <li className="px-3 py-2.5 text-sm text-ink-500">No one matches. Check the spelling.</li> : null}
          {hits.map((u, i) => (
            <li
              key={u.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(u);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-12 cursor-pointer flex-col justify-center rounded-xl px-3 py-1.5 ${i === active ? "bg-brand-50" : ""}`}
            >
              <span className="text-sm font-semibold text-ink-900">{u.name ?? u.email}</span>
              {u.name ? <span className="text-xs text-ink-500">{u.email}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Send or Save as draft from one form; only the tapped button shows it's busy. */
function IntentButton({ intent, inactive, children, busy, primary }: { intent: "send" | "draft"; inactive: boolean; children: React.ReactNode; busy: string; primary?: boolean }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("intent") === intent;
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      aria-disabled={inactive || pending || undefined}
      aria-busy={mine || undefined}
      onClick={(e) => {
        if (inactive || pending) e.preventDefault();
      }}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-colors active:scale-[0.98] aria-disabled:cursor-not-allowed ${primary ? "bg-brand-600 text-white hover:bg-brand-700 aria-disabled:bg-ink-150 aria-disabled:text-ink-500" : "border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 aria-disabled:text-ink-400"}`}
    >
      {mine ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
      {mine ? busy : children}
    </button>
  );
}

export function SendUpdateForm({ draft = null }: { draft?: MessageDraft | null }) {
  const [state, action] = useActionState<AdminActionState, FormData>(sendUpdate, undefined);
  const [to, setTo] = useState<string>(draft?.audience ?? "everyone");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  // Controlled, so a failed send never wipes what was typed.
  const [email, setEmail] = useState(draft?.email ?? "");
  const [recipient, setRecipient] = useState<UserHit | null>(null);
  const [link, setLink] = useState(draft?.link ?? "");
  const [days, setDays] = useState(draft?.days ? String(draft.days) : "");
  const ready = title.trim().length >= 3 && body.trim().length >= 3 && (to !== "person" || email.trim().length >= 3);
  const emailError = state?.field === "email" ? state.error : undefined;
  return (
    <form action={action} className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {draft ? <input type="hidden" name="draft_id" value={draft.id} /> : null}
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
        {to === "person" ? <RecipientField email={email} setEmail={setEmail} recipient={recipient} setRecipient={setRecipient} error={emailError} /> : null}
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
            <input id="u-link" name="link" value={link} onChange={(e) => setLink(e.target.value)} className={`${inputClass} mt-2`} placeholder="/pass" />
          </div>
          {to !== "person" ? (
            <div>
              <label htmlFor="u-days" className="text-sm font-semibold text-ink-900">
                Show for <span className="font-normal text-ink-500">(days, optional)</span>
              </label>
              <input id="u-days" name="days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className={`${inputClass} mt-2`} placeholder="Until you end it" />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IntentButton intent="send" inactive={!ready} busy="Sending" primary>
            {draft ? "Send now" : "Send"}
          </IntentButton>
          <IntentButton intent="draft" inactive={!ready} busy="Saving">
            {draft ? "Save changes" : "Save as draft"}
          </IntentButton>
          {draft ? (
            <a href="/admin/messages" className="inline-flex min-h-12 items-center rounded-2xl px-4 text-sm font-semibold text-ink-600 hover:bg-ink-75">
              Cancel
            </a>
          ) : null}
          <Result state={emailError ? undefined : state} />
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
