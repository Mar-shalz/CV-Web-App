"use client";

import { useState } from "react";
import { confirmItem, confirmRole, deleteItem, deleteRole } from "@/app/(app)/experience/actions";
import type { VaultItem, VaultRole } from "@/lib/vault/data";
import { ROLE_KIND_LABELS, EMPLOYMENT_LABELS } from "@/lib/vault/schema";
import { rangeLabel } from "@/lib/vault/dates";
import dynamic from "next/dynamic";

// The edit forms load only when someone edits or adds, which keeps My Experience inside
// the first load budget (300KB).
const RoleForm = dynamic(() => import("./role-form").then((m) => m.RoleForm));
const ItemForm = dynamic(() => import("./item-form").then((m) => m.ItemForm));
import { Badge } from "@/components/ui/status";
import { AddCircle, ArrowDown2, Edit2, Trash, TickCircle, Warning2, Briefcase, Book1, Award, Teacher, Building4, People, Lamp } from "@/components/icons";
import { PendingButton } from "@/components/ui/pending-button";

const KIND_ICON = {
  job: Briefcase,
  internship_siwes: Building4,
  nysc_ppa: Award,
  volunteer: People,
  project: Lamp,
  education: Book1,
  certification: Teacher,
  licence: Teacher,
} as const;

const SOURCE = {
  cv_import: "From your CV",
  voice: "From your voice answers",
  text: "Typed by you",
} as const;
const OWN = {
  did: "You did it",
  helped: "You helped",
  led: "You led it",
} as const;

/**
 * One role with its achievements, folded to its header until opened (D-102). It opens by
 * itself when something in it still needs a check, and always on the review page.
 */
export function RoleCard({ role, mode = "vault" }: { role: VaultRole; mode?: "vault" | "review" }) {
  const unchecked = role.items.filter((i) => !i.confirmed).length;
  const needsCheck = !role.confirmed || unchecked > 0;
  const [open, setOpen] = useState(mode === "review" || needsCheck);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = KIND_ICON[role.kind];
  const bodyId = `role-body-${role.id}`;
  const isRecordOnly = role.kind === "education" || role.kind === "certification" || role.kind === "licence";
  const noDates = !role.start && !role.isCurrent;

  return (
    <article className={`rounded-[var(--radius-card)] border bg-white shadow-card transition-colors ${role.confirmed ? "border-ink-150" : "border-care-100"}`}>
      <header className="flex items-start gap-3.5 p-4 lg:p-5">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${role.confirmed ? "bg-brand-50 text-brand-700" : "bg-care-50 text-care-700"}`}>
          <Icon size={24} variant="bulk" />
        </span>
        {/* The title button's hit area stretches over the whole text block, so a tap anywhere on it folds or opens the card. */}
        <div className="relative min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-500">{ROLE_KIND_LABELS[role.kind]}</p>
          <h3 className="text-[1.0625rem] font-semibold leading-6 text-ink-900">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={bodyId} className="text-left after:absolute after:inset-0 after:rounded-xl after:content-['']">
              {role.title ?? "Untitled"}
            </button>
          </h3>
          <p className="text-sm text-ink-600">{[role.organisation, role.location].filter(Boolean).join(" · ") || "Organisation not added"}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">
            {rangeLabel(role.start, role.end, role.isCurrent)}
            {role.grade ? ` · ${role.grade}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {role.confirmed ? <Badge tone="proof">Confirmed</Badge> : <Badge tone="care">Check these details</Badge>}
            {role.employmentType && role.employmentType !== "full_time" ? <Badge tone="neutral">{EMPLOYMENT_LABELS[role.employmentType]}</Badge> : null}
            {noDates ? <Badge tone="care">No dates</Badge> : null}
            {!isRecordOnly && role.items.length === 0 ? <Badge tone="neutral">No achievements yet</Badge> : null}
            {!isRecordOnly && role.items.length ? (
              <Badge tone={unchecked ? "care" : "neutral"}>
                {role.items.length} {role.items.length === 1 ? "achievement" : "achievements"}
                {unchecked ? `, ${unchecked} to check` : ""}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing((e) => !e);
              setOpen(true);
            }}
            className="grid size-11 place-items-center rounded-xl text-ink-500 hover:bg-ink-75 hover:text-ink-900"
            aria-label={`Edit ${role.title ?? "role"}`}
            aria-expanded={editing}
          >
            <Edit2 size={20} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="grid size-11 place-items-center rounded-xl text-ink-500 hover:bg-flag-50 hover:text-flag-700"
            aria-label={`Remove ${role.title ?? "role"}`}
          >
            <Trash size={20} />
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? `Fold ${role.title ?? "role"}` : `Open ${role.title ?? "role"} to see and edit its achievements`}
            className="grid size-11 place-items-center rounded-xl bg-ink-75 text-ink-700 transition-colors hover:bg-ink-100"
          >
            <ArrowDown2 size={18} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </header>

      {confirmDelete ? (
        <div className="mx-4 mb-4 animate-rise rounded-2xl bg-flag-50 p-3.5 text-sm text-flag-700 lg:mx-5" role="alert">
          <p className="font-medium">Remove this role and its {role.items.length} achievements from your experience?</p>
          <div className="mt-3 flex gap-2">
            <form action={deleteRole}>
              <input type="hidden" name="role_id" value={role.id} />
              <PendingButton pendingLabel="Removing" className="min-h-11 rounded-xl bg-flag-600 px-4 text-sm font-semibold text-white hover:bg-flag-700">
                Remove
              </PendingButton>
            </form>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-ink-700">
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div id={bodyId} className="animate-rise">
          {editing ? (
            <div className="animate-rise border-t border-ink-100 p-4 lg:p-5">
              <RoleForm role={role} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
            </div>
          ) : !role.confirmed ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 px-4 py-3 lg:px-5">
              <p className="mr-auto text-[0.8125rem] text-ink-600">Is the title, employer, dates{role.grade ? " and grade" : ""} right?</p>
              <form action={confirmRole}>
                <input type="hidden" name="role_id" value={role.id} />
                <PendingButton pendingLabel="Saving" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-proof-50 px-4 text-sm font-semibold text-proof-700 hover:bg-proof-100">
                  <TickCircle size={18} variant="bulk" />
                  Yes, that&apos;s right
                </PendingButton>
              </form>
              <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-xl bg-ink-75 px-4 text-sm font-semibold text-ink-700 hover:bg-ink-100">
                Fix it
              </button>
            </div>
          ) : null}

          {role.items.length ? (
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {role.items.map((item) => (
                <ItemRow key={item.id} item={item} roleId={role.id} />
              ))}
            </ul>
          ) : null}

          {!isRecordOnly ? (
            <div className="border-t border-ink-100 p-3 lg:px-5">
              {adding ? (
                <div className="animate-rise p-1">
                  <ItemForm roleId={role.id} onDone={() => setAdding(false)} />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                    <AddCircle size={20} />
                    Add an achievement
                  </button>
                  {mode === "review" && unchecked > 1 ? (
                    <form action={confirmRole} className="ml-auto">
                      <input type="hidden" name="role_id" value={role.id} />
                      <input type="hidden" name="with_items" value="1" />
                      <PendingButton pendingLabel="Confirming" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-proof-700 hover:bg-proof-50">
                        Confirm all {unchecked}
                      </PendingButton>
                    </form>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ItemRow({ item, roleId }: { item: VaultItem; roleId: string }) {
  const [editing, setEditing] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const noNumber = item.metrics.length === 0 && !/\d/.test(item.text);

  if (editing) {
    return (
      <li className="animate-rise bg-ink-50/60 p-4 lg:px-5">
        <ItemForm roleId={roleId} item={item} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className={`p-4 lg:px-5 ${item.confirmed ? "" : "bg-care-50/40"}`}>
      <div className="flex items-start gap-3">
        {item.confirmed ? <TickCircle size={20} variant="bulk" className="mt-0.5 shrink-0 text-proof-600" /> : <Warning2 size={20} variant="bulk" className="mt-0.5 shrink-0 text-care-600" />}
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] leading-6 text-ink-900">{item.text}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
            <span>{OWN[item.ownership]}</span>
            {item.sourceQuote ? (
              <button type="button" onClick={() => setShowSource((s) => !s)} className="font-medium text-brand-700 underline-offset-2 hover:underline" aria-expanded={showSource}>
                {SOURCE[item.sourceType]}
              </button>
            ) : (
              <span>{SOURCE[item.sourceType]}</span>
            )}
            {!item.confirmed ? <span className="font-medium text-care-700">Not used until you confirm</span> : null}
          </p>
          {showSource && item.sourceQuote ? (
            <blockquote className="mt-2 animate-rise rounded-xl border-l-4 border-brand-200 bg-ink-50 px-3 py-2 text-[0.8125rem] italic leading-5 text-ink-700">&ldquo;{item.sourceQuote}&rdquo;</blockquote>
          ) : null}
          {!item.confirmed && noNumber ? <p className="mt-1.5 text-xs text-care-700">Tip: a number makes this stronger. How many, how often, how much?</p> : null}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {!item.confirmed ? (
              <form action={confirmItem}>
                <input type="hidden" name="item_id" value={item.id} />
                <PendingButton pendingLabel="Saving" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-proof-50 px-3.5 text-sm font-semibold text-proof-700 hover:bg-proof-100">
                  <TickCircle size={18} variant="bulk" />
                  Confirm
                </PendingButton>
              </form>
            ) : null}
            <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-xl bg-ink-75 px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-100">
              Edit
            </button>
            <form action={deleteItem}>
              <input type="hidden" name="item_id" value={item.id} />
              <PendingButton pendingLabel="Removing" className="min-h-11 rounded-xl px-3.5 text-sm font-semibold text-ink-500 hover:bg-flag-50 hover:text-flag-700">
                Remove
              </PendingButton>
            </form>
          </div>
        </div>
      </div>
    </li>
  );
}
