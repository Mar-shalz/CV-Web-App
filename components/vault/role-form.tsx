"use client";

import { useActionState, useState } from "react";
import { saveRole, type VaultActionState } from "@/app/(app)/vault/actions";
import { ROLE_KINDS, ROLE_KIND_LABELS, type RoleKind } from "@/lib/vault/schema";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import type { VaultRole } from "@/lib/vault/data";

const LABELS: Record<RoleKind, { title: string; org: string; grade?: string }> = {
  job: { title: "Job title", org: "Employer" },
  internship_siwes: { title: "Title", org: "Company or organisation" },
  nysc_ppa: { title: "Your role at your PPA", org: "Place of primary assignment" },
  volunteer: { title: "Role", org: "Organisation, club or community" },
  project: { title: "Project name", org: "Where (school, company, personal)" },
  education: { title: "Degree or certificate (for example BSc Accounting)", org: "School", grade: "Class of degree or CGPA, as written (for example Second Class Upper, or 3.62/5.00)" },
  certification: { title: "Certification", org: "Awarding body", grade: "Status (for example qualified, or in progress)" },
  licence: { title: "Licence or membership", org: "Awarding body", grade: "Status or membership number" },
};

/** Add or edit a role. Employer, title, dates and grade are facts the CV can never change. */
export function RoleForm({ role, defaultKind = "job", onDone }: { role?: VaultRole; defaultKind?: RoleKind; onDone?: () => void }) {
  const [state, action] = useActionState<VaultActionState, FormData>(async (prev, fd) => {
    const res = await saveRole(prev, fd);
    if (res?.ok) onDone?.();
    return res;
  }, undefined);
  const [kind, setKind] = useState<RoleKind>(role?.kind ?? defaultKind);
  const [current, setCurrent] = useState(role?.isCurrent ?? false);
  const l = LABELS[kind];
  const field = "space-y-1.5";
  const label = "block text-sm font-semibold text-ink-900";

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state?.error} />
      {role ? <input type="hidden" name="role_id" value={role.id} /> : null}
      <div className={field}>
        <label htmlFor="kind" className={label}>
          Type
        </label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as RoleKind)} className={inputClass}>
          {ROLE_KINDS.map((k) => (
            <option key={k} value={k}>
              {ROLE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={field}>
          <label htmlFor="title" className={label}>
            {l.title}
          </label>
          <input id="title" name="title" defaultValue={role?.title ?? ""} className={inputClass} />
        </div>
        <div className={field}>
          <label htmlFor="organisation" className={label}>
            {l.org}
          </label>
          <input id="organisation" name="organisation" defaultValue={role?.organisation ?? ""} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={field}>
          <label htmlFor="start" className={label}>
            Started
          </label>
          <input id="start" name="start" type="month" defaultValue={role?.start ?? ""} className={inputClass} />
        </div>
        <div className={field}>
          <label htmlFor="end" className={label}>
            Finished
          </label>
          <input id="end" name="end" type="month" defaultValue={role?.end ?? ""} disabled={current} className={`${inputClass} disabled:opacity-50`} />
        </div>
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
      <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving">
        {role ? "Save and confirm" : "Add this"}
      </SubmitButton>
    </form>
  );
}
