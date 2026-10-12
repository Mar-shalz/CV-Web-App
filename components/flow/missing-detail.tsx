"use client";

import { useActionState, useState } from "react";
import { saveDetail, type DetailState } from "@/app/(app)/jobs/[id]/check/actions";
import type { MissingDetail } from "@/lib/rules/eligibility/types";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import { Lock1, MessageQuestion } from "@/components/icons";

const COPY: Record<MissingDetail, { title: string; why: string; sensitive?: boolean }> = {
  date_of_birth: { title: "What's your date of birth?", why: "This job has an age limit. We use your date of birth only to check limits like this, keep it encrypted, and never put it on a CV without asking.", sensitive: true },
  gender: { title: "This post has a gender requirement", why: "You can tell us privately to check it, or skip this question and decide for yourself.", sensitive: true },
  nysc_status: { title: "Where are you with NYSC?", why: "This job has an NYSC requirement.", sensitive: true },
  degree_class: { title: "What class of degree did you get?", why: "This job asks for a minimum class of degree." },
  cgpa_scale: { title: "What was your CGPA, and on what scale?", why: "This job asks for a minimum CGPA. We only compare CGPAs on the same scale." },
  location: { title: "Where do you live?", why: "This job asks for candidates in a particular place." },
  olevel: { title: "Add your O level results", why: "This job asks for O level credits." },
  licence: { title: "Do you hold this licence or certification?", why: "This job asks for it." },
  right_to_work: { title: "Can you already work in this country?", why: "This job has a right to work requirement." },
  education: { title: "Add your education", why: "This job has a requirement about your qualification." },
};

const label = "block text-sm font-semibold text-ink-900";

export function MissingDetailCard({ jobId, need, quote, country }: { jobId: string; need: MissingDetail; quote: string; country?: string }) {
  const [state, action] = useActionState<DetailState, FormData>(saveDetail, undefined);
  const [nysc, setNysc] = useState("");
  const [rows, setRows] = useState(5);
  const c = COPY[need];

  if (state?.ok) {
    return <p className="animate-pop rounded-2xl bg-proof-50 p-4 text-sm font-medium text-proof-700">Saved. The check above is up to date.</p>;
  }

  return (
    <form action={action} className="space-y-4 rounded-[var(--radius-card)] border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5" noValidate>
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="kind" value={need} />
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-card">
          <MessageQuestion size={22} variant="bulk" />
        </span>
        <div>
          <h3 className="text-[0.9375rem] font-semibold text-ink-900">{c.title}</h3>
          <p className="mt-0.5 text-[0.8125rem] leading-5 text-ink-600">{c.why}</p>
          {quote ? <p className="mt-1 text-xs italic text-ink-500">The post says: &ldquo;{quote}&rdquo;</p> : null}
        </div>
      </div>
      <FormError message={state?.error} />

      {need === "date_of_birth" ? (
        <div className="space-y-1.5">
          <label htmlFor="dob" className={label}>
            Date of birth
          </label>
          <input id="dob" name="date_of_birth" type="date" className={inputClass} max={new Date().toISOString().slice(0, 10)} />
        </div>
      ) : null}

      {need === "gender" ? (
        <div className="grid grid-cols-2 gap-2">
          {["female", "male"].map((g) => (
            <label key={g} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold capitalize text-ink-800 ring-1 ring-ink-150 has-[:checked]:bg-brand-600 has-[:checked]:text-white">
              <input type="radio" name="gender" value={g} className="sr-only" />
              {g}
            </label>
          ))}
        </div>
      ) : null}

      {need === "nysc_status" ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["completed", "Completed"],
              ["serving", "Serving now"],
              ["exempted", "Exempted"],
            ].map(([v, l]) => (
              <label key={v} className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-white text-sm font-semibold text-ink-800 ring-1 ring-ink-150 has-[:checked]:bg-brand-600 has-[:checked]:text-white">
                <input type="radio" name="nysc_status" value={v} checked={nysc === v} onChange={() => setNysc(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
          {nysc === "serving" ? (
            <div className="space-y-1.5">
              <label htmlFor="nysc_end" className={label}>
                Your service ends in
              </label>
              <input id="nysc_end" name="nysc_end" type="month" className={inputClass} />
            </div>
          ) : null}
        </div>
      ) : null}

      {need === "degree_class" || need === "cgpa_scale" ? (
        <div className="space-y-1.5">
          <label htmlFor="grade" className={label}>
            {need === "degree_class" ? "Class of degree, as written" : "CGPA with its scale"}
          </label>
          <input id="grade" name="grade" placeholder={need === "degree_class" ? "For example: Second Class Upper" : "For example: 3.62/5.00"} className={inputClass} />
        </div>
      ) : null}

      {need === "location" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="city" className={label}>
              City or area
            </label>
            <input id="city" name="city" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="state" className={label}>
              State
            </label>
            <input id="state" name="state" className={inputClass} />
          </div>
        </div>
      ) : null}

      {need === "right_to_work" ? (
        <>
          <input type="hidden" name="country" value={country ?? ""} />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["yes", "Yes, I can work there"],
              ["needs_sponsorship", "I'd need a visa"],
            ].map(([v, l]) => (
              <label key={v} className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-white px-3 text-sm font-semibold text-ink-800 ring-1 ring-ink-150 has-[:checked]:bg-brand-600 has-[:checked]:text-white">
                <input type="radio" name="status" value={v} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </>
      ) : null}

      {need === "licence" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="lic" className={label}>
              Name
            </label>
            <input id="lic" name="name" placeholder="For example: ICAN" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lic-status" className={label}>
              Status
            </label>
            <select id="lic-status" name="status" className={`${inputClass} appearance-none`}>
              <option value="qualified">Fully qualified</option>
              <option value="in progress">In progress</option>
              <option value="part qualified">Part qualified</option>
            </select>
          </div>
        </div>
      ) : null}

      {need === "olevel" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select name="exam" aria-label="Exam" className={`${inputClass} appearance-none`}>
              <option value="WAEC">WAEC</option>
              <option value="NECO">NECO</option>
              <option value="GCE">GCE</option>
            </select>
            <input name="year" type="number" min={1990} max={2030} placeholder="Year" aria-label="Year" className={inputClass} />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid grid-cols-[1fr_96px] gap-2">
              <input name="subject" placeholder={["English Language", "Mathematics", "Economics", "Biology", "Government"][i] ?? "Subject"} aria-label={`Subject ${i + 1}`} className={inputClass} />
              <select name="grade" aria-label={`Grade ${i + 1}`} className={`${inputClass} appearance-none`} defaultValue="">
                <option value="">Grade</option>
                {["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
          ))}
          {rows < 9 ? (
            <button type="button" onClick={() => setRows((r) => r + 1)} className="min-h-11 text-sm font-semibold text-brand-700">
              Add a subject
            </button>
          ) : null}
          <p className="text-xs text-ink-500">One sitting at a time. Add your second sitting after saving this one.</p>
        </div>
      ) : null}

      {c.sensitive ? (
        <p className="flex items-start gap-2 text-xs leading-5 text-ink-500">
          <Lock1 size={16} className="mt-px shrink-0" />
          Encrypted and kept apart from your CV. You can see or delete it any time in Settings.
        </p>
      ) : null}
      {need !== "education" ? (
        <SubmitButton size="sm" pendingLabel="Saving">
          Save and update the check
        </SubmitButton>
      ) : (
        <a href="/vault/new" className="inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white">
          Add education
        </a>
      )}
    </form>
  );
}
