"use client";

import { useActionState, useState } from "react";
import { saveRole, type VaultActionState } from "@/app/(app)/experience/actions";
import { ROLE_KINDS, EMPLOYMENT_TYPES, EMPLOYMENT_LABELS, EMPLOYMENT_KINDS, type RoleKind, type EmploymentType } from "@/lib/vault/schema";
import { inputClass } from "@/components/ui/field";
import { MonthYearField } from "@/components/ui/date-fields";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import { Add, Trash, TickCircle } from "@/components/icons";
import { VoiceRecorder } from "./voice-recorder";
import type { VaultRole } from "@/lib/vault/data";

// Words people use on CVs: "Work experience" rather than "Job".
const OPTION_LABELS: Record<RoleKind, string> = {
  job: "Work experience",
  internship_siwes: "Internship or SIWES",
  nysc_ppa: "NYSC (your place of primary assignment)",
  volunteer: "Volunteering, leadership or a campus role",
  project: "Project",
  education: "Education (degree, HND, OND)",
  certification: "Professional certificate (for example ICAN, ACCA)",
  licence: "Licence or professional membership",
};

const LABELS: Record<RoleKind, { title: string; titleHint: string; org: string; grade?: string }> = {
  job: { title: "Your job title", titleHint: "For example Accounts Officer", org: "Company or organisation" },
  internship_siwes: { title: "Your title", titleHint: "For example Audit Intern", org: "Company or organisation" },
  nysc_ppa: { title: "Your role at your PPA", titleHint: "For example Finance Assistant", org: "Place of primary assignment" },
  volunteer: { title: "Your role", titleHint: "For example Class Representative", org: "Organisation, club or community" },
  project: { title: "Project name", titleHint: "For example Final year project", org: "Where (school, company, personal)" },
  education: { title: "Degree or certificate", titleHint: "For example BSc Accounting", org: "School", grade: "Class of degree or CGPA, as written (for example Second Class Upper, or 3.62/5.00)" },
  certification: { title: "Certificate", titleHint: "For example ICAN Skills level", org: "Awarding body", grade: "Status (for example qualified, or in progress)" },
  licence: { title: "Licence or membership", titleHint: "For example COREN", org: "Awarding body", grade: "Status or membership number" },
};

// Roles where "what you did" makes CV lines. Education and certificates don't need it.
const HAS_WORK: RoleKind[] = ["job", "internship_siwes", "nysc_ppa", "volunteer", "project"];

/** Add or edit a role. Employer, title, dates and grade are facts the CV can never change. */
export function RoleForm({ role, defaultKind = "job", onDone, onCancel }: { role?: VaultRole; defaultKind?: RoleKind; onDone?: () => void; onCancel?: () => void }) {
  const [state, action] = useActionState<VaultActionState, FormData>(async (prev, fd) => {
    const res = await saveRole(prev, fd);
    if (res?.ok) onDone?.();
    return res;
  }, undefined);
  const [kind, setKind] = useState<RoleKind>(role?.kind ?? defaultKind);
  const [current, setCurrent] = useState(role?.isCurrent ?? false);
  const [employment, setEmployment] = useState<EmploymentType>(role?.employmentType ?? "full_time");
  const hasEmployment = EMPLOYMENT_KINDS.includes(kind);
  const [things, setThings] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const l = LABELS[kind];
  const field = "space-y-1.5";
  const label = "block text-sm font-semibold text-ink-900";
  const canAddThing = draft.trim().length >= 8;

  function addThing() {
    if (!canAddThing) return;
    setThings((t) => [...t, draft.trim()]);
    setDraft("");
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state?.error} />
      {role ? <input type="hidden" name="role_id" value={role.id} /> : null}
      <div className={`grid gap-4 ${hasEmployment ? "sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : ""}`}>
        <div className={field}>
          <label htmlFor="kind" className={label}>
            What kind of role is this?
          </label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as RoleKind)} className={inputClass}>
            {ROLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {OPTION_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        {hasEmployment ? (
          <div className={`${field} animate-rise`}>
            <label htmlFor="employment_type" className={label}>
              Full time, part time or contract?
            </label>
            <select id="employment_type" name="employment_type" value={employment} onChange={(e) => setEmployment(e.target.value as EmploymentType)} aria-describedby="employment-hint" className={inputClass}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {hasEmployment ? (
        <p id="employment-hint" className="-mt-2 text-xs leading-5 text-ink-500">
          {employment === "full_time"
            ? "Full time roles need no label on your CV."
            : employment === "contract"
              ? "Your CV will say Contract next to the job title, so an employer knows a short stay was planned."
              : "Your CV will say Part-time next to the job title."}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={field}>
          <label htmlFor="title" className={label}>
            {l.title}
          </label>
          <input id="title" name="title" defaultValue={role?.title ?? ""} placeholder={l.titleHint} className={inputClass} />
        </div>
        <div className={field}>
          <label htmlFor="organisation" className={label}>
            {l.org}
          </label>
          <input id="organisation" name="organisation" defaultValue={role?.organisation ?? ""} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MonthYearField id="start" name="start" label="Started" defaultValue={role?.start} />
        <MonthYearField id="end" name="end" label="Finished" defaultValue={role?.end} disabled={current} />
      </div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm font-medium text-ink-800">
        <input type="checkbox" name="is_current" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-5 accent-brand-600" />
        I&apos;m still doing this
      </label>
      <div className={field}>
        <label htmlFor="location" className={label}>
          Location <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input id="location" name="location" defaultValue={role?.location ?? ""} placeholder="City, state" className={inputClass} />
      </div>
      {l.grade ? (
        <div className={field}>
          <label htmlFor="grade" className={label}>
            {l.grade}
          </label>
          <input id="grade" name="grade" defaultValue={role?.grade ?? ""} className={inputClass} />
          <p className="text-xs text-ink-500">Write it exactly as it is on your certificate. We never change it.</p>
        </div>
      ) : null}

      {!role && HAS_WORK.includes(kind) ? (
        <section aria-labelledby="did-title" className="rounded-2xl border border-ink-150 bg-ink-50 p-4">
          <h3 id="did-title" className="text-sm font-semibold text-ink-900">
            What Did You Do There? <span className="font-normal text-ink-500">(optional, you can add more later)</span>
          </h3>
          <p className="mt-1 text-[0.8125rem] leading-5 text-ink-600">Add one thing at a time. Each one becomes one line on your CV. Say what you did and, if you can, how many or how often.</p>
          {things.length ? (
            <ol className="mt-3 space-y-2">
              {things.map((t, i) => (
                <li key={`${i}-${t}`} className="flex animate-pop items-start gap-2.5 rounded-xl bg-white p-3 text-sm text-ink-800 shadow-card">
                  <TickCircle size={18} variant="bulk" className="mt-0.5 shrink-0 text-proof-600" />
                  <span className="flex-1">{t}</span>
                  <input type="hidden" name="items" value={t} />
                  <button
                    type="button"
                    onClick={() => setThings((all) => all.filter((_, j) => j !== i))}
                    aria-label={`Remove: ${t}`}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-flag-600 hover:bg-flag-50"
                  >
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          <label htmlFor="thing" className="mt-3 block text-[0.8125rem] font-semibold text-ink-800">
            {things.length ? `Thing ${things.length + 1}` : "Thing 1"}
          </label>
          <textarea
            id="thing"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addThing();
              }
            }}
            placeholder="For example: Reconciled about 40 customer accounts each day with the bank statement."
            className={`${inputClass} mt-1.5 resize-y py-3 leading-6`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addThing}
              aria-disabled={!canAddThing || undefined}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-semibold text-brand-700 ring-1 ring-ink-150 hover:bg-brand-50 aria-disabled:cursor-not-allowed aria-disabled:text-ink-400"
            >
              <Add size={18} />
              {things.length ? "Add this one too" : "Add this one"}
            </button>
            <VoiceRecorder compact onText={(t) => setDraft((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t))} />
          </div>
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving">
          {role ? "Save and confirm" : things.length ? `Save role and ${things.length} ${things.length === 1 ? "thing" : "things"} you did` : "Save role"}
        </SubmitButton>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-ink-700 hover:bg-ink-75">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
