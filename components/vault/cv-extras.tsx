"use client";

import { useState, useTransition } from "react";
import type { AddedSkill, CvExtras, Referee } from "@/lib/vault/extras";
import { saveSummary, saveSkills, saveReferees, removeAddedSkill } from "@/app/(app)/experience/extras-actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import { Edit2, Trash, Add, Profile2User, DocumentText, Magicpen, TickCircle } from "@/components/icons";

/**
 * The parts of a CV that aren't roles (D-162): the person's own profile summary, skills,
 * referees, and skills they added while checking jobs (kept apart, removable).
 */
export function CvExtrasPanel({ extras }: { extras: CvExtras }) {
  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <SummaryCard initial={extras.summary} />
      <SkillsCard initial={extras.skills} added={extras.addedSkills} />
      <RefereesCard initial={extras.referees} />
    </div>
  );
}

function Card({ icon, title, hint, action, children }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            <p className="text-[0.8125rem] leading-5 text-ink-500">{hint}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-ink-150 px-3 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
      <Edit2 size={16} />
      {label}
    </button>
  );
}

function SummaryCard({ initial }: { initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await saveSummary(text);
      if (!res.ok) return setError(res.error);
      setError(null);
      setEditing(false);
      toast("Profile summary saved.");
    });
  return (
    <Card
      icon={<DocumentText size={20} variant="bulk" />}
      title="Profile Summary"
      hint="Your own two to four lines. For each job we suggest a version that fits it, and you choose."
      action={!editing ? <EditButton onClick={() => setEditing(true)} label={initial || text ? "Edit" : "Add"} /> : null}
    >
      {editing ? (
        <div className="space-y-2">
          <label htmlFor="own-summary" className="sr-only">
            Profile summary
          </label>
          <textarea id="own-summary" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: Accounting graduate with SIWES banking experience. Good with Excel, reconciliations and customers." className={`${inputClass} py-2.5 text-sm leading-6`} />
          {error ? <p className="text-xs text-flag-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy}>
              Save summary
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (setText(initial ?? ""), setEditing(false), setError(null))}>
              Cancel
            </Button>
          </div>
        </div>
      ) : text ? (
        <p className="text-sm leading-6 text-ink-800">{text}</p>
      ) : (
        <p className="rounded-2xl bg-ink-50 p-3 text-[0.8125rem] text-ink-600">No summary yet. Add one, or upload your CV and we&apos;ll copy it from there.</p>
      )}
    </Card>
  );
}

function SkillsCard({ initial, added }: { initial: string[]; added: AddedSkill[] }) {
  const [skills, setSkills] = useState(initial);
  const [extra, setExtra] = useState(added);
  const [draft, setDraft] = useState(initial.join(", "));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await saveSkills(draft);
      if (!res.ok) return setError(res.error);
      setSkills(
        draft
          .split(/[,\n;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      setError(null);
      setEditing(false);
      toast("Skills saved.");
    });
  const remove = (a: AddedSkill) =>
    start(async () => {
      const res = await removeAddedSkill(a.id);
      if (!res.ok) return toast(res.error, "error");
      setExtra((x) => x.filter((y) => y.id !== a.id));
      toast(`Removed ${a.skill}.`);
    });
  return (
    <Card icon={<Magicpen size={20} variant="bulk" />} title="Skills" hint="Skills, tools, software and languages. Used in the Skills section of your CVs." action={!editing ? <EditButton onClick={() => setEditing(true)} label={skills.length ? "Edit" : "Add"} /> : null}>
      {editing ? (
        <div className="space-y-2">
          <label htmlFor="own-skills" className="text-[0.8125rem] font-medium text-ink-700">
            Separate them with commas
          </label>
          <textarea id="own-skills" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Excel, Sage 50, reconciliation, customer service, Yoruba" className={`${inputClass} py-2.5 text-sm leading-6`} />
          {error ? <p className="text-xs text-flag-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy}>
              Save skills
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (setDraft(skills.join(", ")), setEditing(false), setError(null))}>
              Cancel
            </Button>
          </div>
        </div>
      ) : skills.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <li key={s} className="rounded-full bg-ink-75 px-3 py-1 text-[0.8125rem] font-medium text-ink-800">
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-ink-50 p-3 text-[0.8125rem] text-ink-600">No skills listed yet.</p>
      )}

      {extra.length ? (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5">
          <p className="text-[0.8125rem] font-semibold text-ink-900">Added while checking jobs</p>
          <p className="text-xs text-ink-500">You told us you have these when a job asked for them. They go in your Skills section.</p>
          <ul className="mt-2 space-y-2">
            {extra.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 rounded-xl bg-white p-2.5 ring-1 ring-brand-100">
                <span className="min-w-0 text-[0.8125rem] leading-5">
                  <span className="font-semibold text-ink-900">{a.skill}</span>
                  {a.note ? <span className="text-ink-700">: {a.note}</span> : null}
                  <span className="block text-xs text-ink-500">For {a.jobTitle ?? "a job"}: &ldquo;{a.requirement}&rdquo;</span>
                </span>
                <button type="button" onClick={() => remove(a)} disabled={busy} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-flag-50 hover:text-flag-700" aria-label={`Remove ${a.skill}`}>
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

const EMPTY_REF: Referee = { name: "", role: null, organisation: null, phone: null, email: null, relationship: null };

function RefereesCard({ initial }: { initial: Referee[] }) {
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState<Referee[]>(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const set = (i: number, k: keyof Referee, v: string) => setDraft((d) => d.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const save = () =>
    start(async () => {
      const clean = draft.map((r) => ({ name: r.name ?? "", role: r.role ?? "", organisation: r.organisation ?? "", phone: r.phone ?? "", email: r.email ?? "", relationship: r.relationship ?? "" })) as unknown as Referee[];
      const res = await saveReferees(clean);
      if (!res.ok) return setError(res.error);
      setList(draft.filter((r) => r.name?.trim()));
      setError(null);
      setEditing(false);
      toast("Referees saved.");
    });
  return (
    <Card
      icon={<Profile2User size={20} variant="bulk" />}
      title="Referees"
      hint="Nigerian employers often want two referees named. Ask them first. They go on a CV only when the job or format wants them; otherwise it says “Available on request”."
      action={!editing ? <EditButton onClick={() => (setDraft(list.length ? list : [EMPTY_REF]), setEditing(true))} label={list.length ? "Edit" : "Add"} /> : null}
    >
      {editing ? (
        <div className="space-y-3">
          {draft.map((r, i) => (
            <fieldset key={i} className="space-y-2 rounded-2xl bg-ink-50 p-3">
              <legend className="sr-only">Referee {i + 1}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <input aria-label="Name" placeholder="Name, for example Mrs Funke Bello" value={r.name ?? ""} onChange={(e) => set(i, "name", e.target.value)} className={`${inputClass} text-sm`} />
                <input aria-label="Their job title" placeholder="Their job title" value={r.role ?? ""} onChange={(e) => set(i, "role", e.target.value)} className={`${inputClass} text-sm`} />
                <input aria-label="Organisation" placeholder="Organisation" value={r.organisation ?? ""} onChange={(e) => set(i, "organisation", e.target.value)} className={`${inputClass} text-sm`} />
                <input aria-label="How they know you" placeholder="How they know you, for example SIWES supervisor" value={r.relationship ?? ""} onChange={(e) => set(i, "relationship", e.target.value)} className={`${inputClass} text-sm`} />
                <input aria-label="Phone" inputMode="tel" placeholder="Phone" value={r.phone ?? ""} onChange={(e) => set(i, "phone", e.target.value)} className={`${inputClass} text-sm`} />
                <input aria-label="Email" type="email" placeholder="Email" value={r.email ?? ""} onChange={(e) => set(i, "email", e.target.value)} className={`${inputClass} text-sm`} />
              </div>
              <button type="button" onClick={() => setDraft((d) => d.filter((_, n) => n !== i))} className="inline-flex min-h-10 items-center gap-1.5 text-[0.8125rem] font-semibold text-flag-700 hover:underline">
                <Trash size={15} />
                Remove this referee
              </button>
            </fieldset>
          ))}
          {draft.length < 4 ? (
            <button type="button" onClick={() => setDraft((d) => [...d, EMPTY_REF])} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              <Add size={18} />
              Add a referee
            </button>
          ) : null}
          {error ? <p className="text-xs text-flag-700">{error}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy}>
              Save referees
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setError(null))}>
              Cancel
            </Button>
          </div>
        </div>
      ) : list.length ? (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.name} className="flex items-start gap-2 text-[0.8125rem] leading-5">
              <TickCircle size={18} variant="bulk" className="mt-px shrink-0 text-proof-600" />
              <span>
                <span className="font-semibold text-ink-900">{r.name}</span>
                {[r.role, r.organisation].filter(Boolean).length ? <span className="text-ink-700">, {[r.role, r.organisation].filter(Boolean).join(", ")}</span> : null}
                <span className="block text-ink-500">{[r.relationship, r.phone, r.email].filter(Boolean).join(" · ") || "No contact details yet"}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-ink-50 p-3 text-[0.8125rem] text-ink-600">No referees yet. Your CVs say &ldquo;Available on request&rdquo; until you add some.</p>
      )}
    </Card>
  );
}
