"use client";

import { useActionState, useState } from "react";
import { saveJobReview, type ReviewState } from "@/app/(app)/jobs/actions";
import type { ParsedJob } from "@/lib/jobs/schema";
import { CHANNEL_LABELS, FILTER_LABELS } from "@/lib/jobs/labels";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import { ArrowRight, CloseCircle, Global, Refresh2 } from "@/components/icons";

type Country = { code: string; label: string };

export function JobReviewForm({
  jobId,
  job,
  destination,
  ask,
  alternatives,
  profileLabel,
  fallbackNote,
  countries,
  manual,
}: {
  jobId: string;
  job: ParsedJob;
  destination: string;
  ask: boolean;
  alternatives: string[];
  profileLabel: string;
  fallbackNote: string | null;
  countries: Country[];
  manual: boolean;
}) {
  const [state, action] = useActionState<ReviewState, FormData>(saveJobReview, undefined);
  const [channel, setChannel] = useState(job.how_to_apply.channel);
  const [dest, setDest] = useState(destination);
  const [picking, setPicking] = useState(ask);
  const [removed, setRemoved] = useState<number[]>([]);
  const [title, setTitle] = useState(job.title ?? "");
  const label = (c: string) => countries.find((x) => x.code === c)?.label ?? c;
  const f = "space-y-1.5";
  const l = "block text-sm font-semibold text-ink-900";

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormError message={state?.error} />
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="destination" value={dest} />
      {removed.map((i) => (
        <input key={i} type="hidden" name="removed_filter" value={i} />
      ))}

      {/* Destination chip: detected from the post, one tap to change, never a blocking question unless unsure */}
      <section className={`rounded-2xl p-4 ${picking ? "border border-brand-200 bg-brand-50" : "bg-ink-75"}`} aria-live="polite">
        {picking ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Global size={20} variant="bulk" className="text-brand-600" />
              Where is this job?
            </p>
            <div className="flex flex-wrap gap-2">
              {alternatives.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setDest(c);
                    setPicking(false);
                  }}
                  className={`min-h-12 rounded-full px-4 text-sm font-semibold ${dest === c ? "bg-brand-600 text-white" : "bg-white text-ink-800 ring-1 ring-ink-150 hover:bg-brand-50"}`}
                >
                  {label(c)}
                </button>
              ))}
              <select
                aria-label="Other country"
                value={alternatives.includes(dest) ? "" : dest}
                onChange={(e) => {
                  if (e.target.value) {
                    setDest(e.target.value);
                    setPicking(false);
                  }
                }}
                className="min-h-12 rounded-full bg-white px-4 text-sm font-semibold text-ink-800 ring-1 ring-ink-150"
              >
                <option value="">Other</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-700">
              Formatting for: <span className="font-semibold text-ink-900">{label(dest)}</span>
              <span className="text-ink-500"> · {dest === destination ? profileLabel : "format set on the next screen"}</span>
            </p>
            <button type="button" onClick={() => setPicking(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-white">
              <Refresh2 size={16} />
              Change
            </button>
          </div>
        )}
        {fallbackNote && dest === destination ? <p className="mt-2 text-xs text-ink-600">{fallbackNote}</p> : null}
      </section>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">The job</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={f}>
            <label htmlFor="title" className={l}>
              Job title
            </label>
            <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} aria-invalid={manual && !title ? true : undefined} />
          </div>
          <div className={f}>
            <label htmlFor="employer_name" className={l}>
              Employer
            </label>
            <input id="employer_name" name="employer_name" defaultValue={job.employer_name ?? ""} placeholder={job.employer_is_agency_client ? "Not named (a recruiter's client)" : ""} className={inputClass} />
          </div>
          <div className={f}>
            <label htmlFor="city" className={l}>
              City or area
            </label>
            <input id="city" name="city" defaultValue={job.location.city ?? ""} className={inputClass} />
          </div>
          <div className={f}>
            <label htmlFor="state" className={l}>
              State
            </label>
            <input id="state" name="state" defaultValue={job.location.state ?? ""} className={inputClass} />
          </div>
          <div className={f}>
            <label htmlFor="deadline" className={l}>
              Closing date
            </label>
            <input id="deadline" name="deadline" type="date" defaultValue={job.deadline ?? ""} className={inputClass} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">How to apply</legend>
        <div className={f}>
          <label htmlFor="channel" className={l}>
            They want applications
          </label>
          <select id="channel" name="channel" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={`${inputClass} appearance-none`}>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {channel === "email" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={f}>
              <label htmlFor="email" className={l}>
                Send to
              </label>
              <input id="email" name="email" type="email" defaultValue={job.how_to_apply.email ?? ""} className={inputClass} />
              <p className="text-xs text-ink-500">Check every letter against the post. One wrong letter and it never arrives.</p>
            </div>
            <div className={f}>
              <label htmlFor="subject_format" className={l}>
                Subject line they asked for
              </label>
              <input id="subject_format" name="subject_format" defaultValue={job.how_to_apply.subject_format ?? ""} placeholder="None stated" className={inputClass} />
            </div>
          </div>
        ) : (
          <div className={f}>
            <label htmlFor="url" className={l}>
              Link to apply
            </label>
            <input id="url" name="url" type="url" defaultValue={job.how_to_apply.url ?? ""} className={inputClass} />
          </div>
        )}
      </fieldset>

      {job.hard_filters.length ? (
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Must-have requirements we found</legend>
          <p className="mt-1 text-[0.8125rem] text-ink-600">Remove any that the post doesn&apos;t really say. We check these next.</p>
          <ul className="mt-3 space-y-2">
            {job.hard_filters.map((h, i) =>
              removed.includes(i) ? null : (
                <li key={i} className="flex items-start gap-3 rounded-2xl bg-ink-50 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{FILTER_LABELS[h.type]}</p>
                    <p className="mt-0.5 text-[0.8125rem] italic text-ink-600">&ldquo;{h.quote}&rdquo;</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoved((r) => [...r, i])}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-500 hover:bg-white hover:text-flag-700"
                    aria-label={`Remove ${FILTER_LABELS[h.type]}`}
                  >
                    <CloseCircle size={20} />
                  </button>
                </li>
              ),
            )}
          </ul>
        </fieldset>
      ) : null}

      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Saving" inactive={!title.trim()}>
        Looks right. Check this job
        <ArrowRight size={20} />
      </SubmitButton>
    </form>
  );
}
