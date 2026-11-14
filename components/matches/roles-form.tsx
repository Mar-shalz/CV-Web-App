"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { saveMatchRoles } from "@/app/(app)/matches/actions";

/**
 * What Jobs for You searches for, and a way to change it (founder round 49): people switching
 * careers name the roles they want next. Saving searches again on the reload.
 */
export function RolesForm({ roles, chosen, max }: { roles: string[]; chosen: boolean; max: number }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => Array.from({ length: max }, (_, i) => roles[i] ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (list: string[]) =>
    start(async () => {
      const res = await saveMatchRoles(list);
      if (!res.ok) return setError(res.error);
      window.location.reload();
    });

  if (!open)
    return (
      <p className="mt-1.5 text-[0.8125rem] text-ink-500">
        {roles.length ? (
          <>
            Searching for {roles.join(", ")}
            {chosen ? "" : ", from your experience"}.{" "}
          </>
        ) : (
          "Add a job you've done, or name the roles you want. "
        )}
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-brand-700 hover:underline">
          Change roles
        </button>
      </p>
    );

  return (
    <form
      className="mt-3 max-w-xl space-y-3 rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        save(values);
      }}
    >
      <div>
        <p className="text-sm font-semibold text-ink-900">Roles to search for</p>
        <p className="mt-0.5 text-[0.8125rem] leading-5 text-ink-500">
          Up to {max}. Switching careers? Name the roles you want next. Your match may be lower at first, and each job shows it so you can decide.
        </p>
      </div>
      {values.map((v, i) => (
        <input
          key={i}
          value={v}
          maxLength={60}
          aria-label={`Role ${i + 1}`}
          placeholder={i === 0 ? "For example, Data Analyst" : "Another role (optional)"}
          onChange={(e) => setValues(values.map((x, j) => (j === i ? e.target.value : x)))}
          className={inputClass}
        />
      ))}
      {error ? (
        <p role="alert" className="text-sm font-medium text-flag-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" pending={pending}>
          Save and search
        </Button>
        {chosen ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => save([])}>
            Use my experience instead
          </Button>
        ) : null}
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
