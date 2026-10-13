"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { saveProfile, setLowData, removeSensitive, setConsent, deleteAccount, type SettingsState } from "@/app/(app)/settings/actions";
import { Field, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TickCircle, Trash, DocumentDownload, Danger } from "@/components/icons";

export type ProfileValues = { full_name: string; phone: string; contact_email: string; city: string; state: string; linkedin_url: string };

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveProfile, undefined);
  const err = (k: keyof ProfileValues) => state?.fieldErrors?.[k];
  const fields: { k: keyof ProfileValues; label: string; type?: string; hint?: string; optional?: boolean; auto?: string }[] = [
    { k: "full_name", label: "Full name", hint: "As it should appear at the top of your CV.", auto: "name" },
    { k: "phone", label: "Phone number", type: "tel", optional: true, auto: "tel" },
    { k: "contact_email", label: "Email for employers", type: "email", hint: "Use a professional address. It can differ from your sign in email.", optional: true, auto: "email" },
    { k: "city", label: "Town or city", optional: true, auto: "address-level2" },
    { k: "state", label: "State", optional: true, auto: "address-level1" },
    { k: "linkedin_url", label: "LinkedIn profile link", type: "url", optional: true },
  ];
  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.k} className={f.k === "full_name" || f.k === "contact_email" || f.k === "linkedin_url" ? "sm:col-span-2" : ""}>
            <Field id={f.k} label={f.label} hint={f.hint} error={err(f.k)} optional={f.optional}>
              <TextInput id={f.k} name={f.k} type={f.type ?? "text"} defaultValue={initial[f.k]} autoComplete={f.auto} invalid={Boolean(err(f.k))} describedBy={err(f.k) ? `${f.k}-error` : f.hint ? `${f.k}-hint` : undefined} />
            </Field>
          </div>
        ))}
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-flag-700">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
        {state?.ok ? (
          <p role="status" className="flex animate-pop items-center gap-1.5 text-sm font-medium text-proof-700">
            <TickCircle size={18} variant="bulk" />
            Saved
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function DataSaverSwitch({ initial, icon }: { initial: boolean; icon?: ReactNode }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  return (
    <label className="flex min-h-[76px] cursor-pointer items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-ink-50">
      {icon ? <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink-75 text-ink-700">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-ink-900">Data saver</span>
        <span className="block text-[0.8125rem] leading-5 text-ink-500">{on ? "On. No animations, phone fonts, lighter pages." : "Off. Turn on to use less data."}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(() => setLowData(next));
        }}
        className="peer sr-only"
      />
      <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

const LABELS: Record<string, string> = { date_of_birth: "Date of birth", gender: "Gender", state_of_origin: "State of origin", nysc_status: "NYSC status", nysc_start: "NYSC start date", nysc_end: "NYSC end date" };

export function SensitiveList({ saved }: { saved: string[] }) {
  const [left, setLeft] = useState(saved);
  const [busy, start] = useTransition();
  const remove = (field: string) =>
    start(async () => {
      const res = await removeSensitive(field);
      if (res.ok) setLeft((cur) => (field === "all" ? [] : cur.filter((f) => f !== field)));
    });
  if (!left.length) return <p className="rounded-2xl bg-ink-50 p-5 text-sm text-ink-600">You haven&apos;t saved any sensitive details. We&apos;ll only ask if a job&apos;s rules or CV format need one.</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-150">
        {left.map((f) => (
          <li key={f} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <span className="text-[0.9375rem] font-medium text-ink-900">{LABELS[f] ?? f}</span>
            <button type="button" disabled={busy} onClick={() => remove(f)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-flag-700 hover:bg-flag-50 disabled:opacity-50">
              <Trash size={16} />
              Delete
              <span className="sr-only"> {LABELS[f]}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="danger" disabled={busy} onClick={() => remove("all")}>
        <Trash size={18} />
        Delete all sensitive details
      </Button>
    </div>
  );
}

export function ConsentSwitch({ type, title, body, initial }: { type: "marketing" | "question_bank" | "sensitive_details"; title: string; body: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-start gap-3.5 rounded-2xl px-3 py-4 hover:bg-ink-50">
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-ink-900">{title}</span>
        <span className="block text-[0.8125rem] leading-5 text-ink-500">{body}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const res = await setConsent(type, next);
            if (!res.ok) setOn(!next);
          });
        }}
        className="peer sr-only"
      />
      <span aria-hidden="true" className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function ExportData() {
  const [sensitive, setSensitive] = useState(false);
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-50 p-4 text-[0.8125rem] leading-5 text-ink-700">
        <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-600" />
        Include my sensitive details (date of birth, gender, state of origin) in this file. Keep the file somewhere safe.
      </label>
      <a href={`/api/me/export${sensitive ? "?sensitive=1" : ""}`} download className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
        <DocumentDownload size={20} />
        Download my data
      </a>
    </div>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(deleteAccount, undefined);
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toUpperCase() === "DELETE";
  return (
    <form action={action} className="space-y-4">
      <Field id="confirm" label="Type DELETE to confirm" error={state?.fieldErrors?.confirm}>
        <TextInput id="confirm" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" invalid={Boolean(state?.fieldErrors?.confirm)} />
      </Field>
      {state?.error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-flag-700">
          <Danger size={18} className="mt-px shrink-0" />
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !ready}
        className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-flag-600 px-5 font-semibold text-white hover:bg-flag-700 disabled:cursor-not-allowed disabled:bg-ink-150 disabled:text-ink-500"
      >
        <Trash size={20} />
        {pending ? "Deleting…" : "Delete my account for good"}
      </button>
    </form>
  );
}
