"use client";

import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import { saveProfile, setLowData, removeSensitive, setConsent, deleteAccount, type SettingsState } from "@/app/(app)/settings/actions";
import { Field, TextInput, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TickCircle, Trash, DocumentDownload, Danger } from "@/components/icons";

export type ProfileValues = { full_name: string; phone: string; contact_email: string; city: string; state: string; linkedin_url: string; portfolio_url: string; website_url: string };
type PhoneCode = { country: string; label: string; code: string };

/** "+234 8030000000" or "08030000000" into a dialling code and the rest. */
function splitPhone(phone: string, codes: PhoneCode[]): { code: string; number: string } {
  const p = phone.trim();
  const match = [...codes].sort((a, b) => b.code.length - a.code.length).find((c) => p.startsWith(c.code));
  if (match) return { code: match.code, number: p.slice(match.code.length).trim() };
  return { code: codes[0]?.code ?? "+234", number: p };
}

export function ProfileForm({ initial, codes }: { initial: ProfileValues; codes: PhoneCode[] }) {
  const start = splitPhone(initial.phone, codes);
  const [values, setValues] = useState({ ...initial, phone_code: start.code, phone: start.number });
  const [saved, setSaved] = useState(values);
  const submitted = useRef(values);
  const [state, action, pending] = useActionState<SettingsState, FormData>(async (prev, fd) => {
    const res = await saveProfile(prev, fd);
    if (res?.ok) setSaved(submitted.current);
    return res;
  }, undefined);
  // Save stays inactive until something changes, and again after a successful save.
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const err = (k: string) => state?.fieldErrors?.[k];
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const text = (k: keyof ProfileValues, label: string, opts: { type?: string; hint?: string; optional?: boolean; auto?: string; placeholder?: string } = {}) => (
    <Field id={k} label={label} hint={opts.hint} error={err(k)} optional={opts.optional}>
      <TextInput id={k} name={k} type={opts.type ?? "text"} value={values[k]} onChange={set(k)} autoComplete={opts.auto} placeholder={opts.placeholder} invalid={Boolean(err(k))} describedBy={err(k) ? `${k}-error` : opts.hint ? `${k}-hint` : undefined} />
    </Field>
  );

  return (
    <form
      action={action}
      onSubmit={() => {
        submitted.current = values;
      }}
      className="space-y-5"
      noValidate
    >
      {text("full_name", "Full name", { hint: "As it should appear at the top of your CV.", auto: "name" })}
      {text("contact_email", "Email for employers", { type: "email", hint: "Use a professional address. It can be different from your sign in email.", optional: true, auto: "email" })}

      <Field id="phone" label="Phone number" error={err("phone")} optional hint="Employers in Nigeria often call before they email.">
        <div className="grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] gap-2">
          <label htmlFor="phone_code" className="sr-only">
            Country code
          </label>
          <select id="phone_code" name="phone_code" value={values.phone_code} onChange={set("phone_code")} className={inputClass} autoComplete="tel-country-code">
            {codes.map((c) => (
              <option key={c.country} value={c.code}>
                {c.label} ({c.code})
              </option>
            ))}
          </select>
          <TextInput id="phone" name="phone" type="tel" inputMode="tel" value={values.phone} onChange={set("phone")} autoComplete="tel-national" placeholder="803 000 0000" invalid={Boolean(err("phone"))} />
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        {text("city", "Town or city", { optional: true, auto: "address-level2" })}
        {text("state", "State or region", { optional: true, auto: "address-level1" })}
      </div>
      {text("linkedin_url", "LinkedIn profile link", { type: "url", optional: true, placeholder: "https://www.linkedin.com/in/your-name" })}
      {text("portfolio_url", "Portfolio link", { type: "url", optional: true, placeholder: "https://", hint: "Behance, GitHub, Dribbble or similar, if you have one." })}
      {text("website_url", "Personal website", { type: "url", optional: true, placeholder: "https://" })}

      {state?.error ? (
        <p role="alert" className="text-sm text-flag-700">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save details"}
        </Button>
        {state?.ok && !dirty ? (
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
          start(async () => {
            const ok = await setLowData(next);
            if (!ok) setOn(!next);
            // Apply at once on this page too, before the refresh arrives.
            document.querySelector("[data-app-shell]")?.toggleAttribute("data-low-data", ok ? next : !next);
          });
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
