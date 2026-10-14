"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInviteDetails } from "@/app/(app)/applications/[id]/shortlist/actions";
import type { InviteDetails } from "@/lib/applications/outcome";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Location, Video, Edit2, Danger } from "@/components/icons";

const FORMATS = [
  { id: "in_person", label: "In person" },
  { id: "video", label: "Video call" },
  { id: "phone", label: "Phone call" },
  { id: "test", label: "Test" },
  { id: "unknown", label: "Not sure yet" },
] as const;

function pretty(date: string) {
  return new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
}

const field = "min-h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-[0.9375rem] text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";

/** The invite (screen 21): when, where, how. Filled from their message, editable by hand. */
export function InviteCard({ applicationId, invite, days }: { applicationId: string; invite: InviteDetails; days: number | null }) {
  const router = useRouter();
  const empty = !invite.date && !invite.time && !invite.placeOrLink;
  const [editing, setEditing] = useState(empty);
  const [form, setForm] = useState({ date: invite.date ?? "", time: invite.time ?? "", placeOrLink: invite.placeOrLink ?? "", format: invite.format });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await saveInviteDetails(applicationId, { date: form.date || null, time: form.time || null, placeOrLink: form.placeOrLink.trim() || null, format: form.format });
      if (!res.ok) return setError(res.error ?? "That didn't save. Try again in a moment.");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <section aria-labelledby="invite-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
        <h2 id="invite-title" className="text-[0.9375rem] font-semibold text-ink-900">
          Your Invite
        </h2>
        <p className="mt-1 text-[0.8125rem] text-ink-600">Add what you know. You can change it later.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-ink-600">
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`mt-1 ${field}`} />
          </label>
          <label className="block text-xs font-medium text-ink-600">
            Time
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={`mt-1 ${field}`} />
          </label>
        </div>
        <fieldset className="mt-3">
          <legend className="text-xs font-medium text-ink-600">How it will run</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <label key={f.id} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium ring-1 transition-colors ${form.format === f.id ? "bg-brand-900 text-white ring-brand-900" : "bg-white text-ink-700 ring-ink-150 hover:bg-ink-50"}`}>
                <input type="radio" name="format" value={f.id} checked={form.format === f.id} onChange={() => setForm({ ...form, format: f.id })} className="sr-only" />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-3 block text-xs font-medium text-ink-600">
          Address or meeting link
          <input value={form.placeOrLink} onChange={(e) => setForm({ ...form, placeOrLink: e.target.value })} maxLength={300} className={`mt-1 ${field}`} />
        </label>
        {error ? (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-flag-700">
            <Danger size={16} />
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={busy}>
            Save
          </Button>
          {!empty ? (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  const link = invite.placeOrLink && /^https?:\/\//i.test(invite.placeOrLink) ? invite.placeOrLink : null;
  return (
    <section aria-labelledby="invite-title" className="relative overflow-hidden rounded-[var(--radius-card)] brand-gradient p-5 text-white shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <h2 id="invite-title" className="text-xs font-semibold uppercase tracking-[0.1em] text-white/75">
          Your Invite
        </h2>
        <button type="button" onClick={() => setEditing(true)} className="-mr-2 -mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white/90 hover:bg-white/10">
          <Edit2 size={16} />
          Edit
        </button>
      </div>
      {days !== null ? (
        <p className="mt-1 font-display text-[2rem] font-semibold leading-10 tracking-[-0.02em]">{days > 1 ? `In ${days} days` : days === 1 ? "Tomorrow" : days === 0 ? "Today" : "Done"}</p>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm">
        {invite.date ? (
          <li className="flex items-center gap-2.5">
            <Calendar size={18} className="text-sky-200" />
            {pretty(invite.date)}
          </li>
        ) : null}
        {invite.time ? (
          <li className="flex items-center gap-2.5">
            <Clock size={18} className="text-sky-200" />
            {invite.time} · {FORMATS.find((f) => f.id === invite.format)?.label}
          </li>
        ) : null}
        {invite.placeOrLink ? (
          <li className="flex items-start gap-2.5">
            {link ? <Video size={18} className="mt-0.5 shrink-0 text-sky-200" /> : <Location size={18} className="mt-0.5 shrink-0 text-sky-200" />}
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-2">
                Join link
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="break-words">{invite.placeOrLink}</span>
            )}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
