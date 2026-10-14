"use client";

import { useActionState, useState } from "react";
import { saveItem, type VaultActionState } from "@/app/(app)/experience/actions";
import { outlinedInputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import type { VaultItem } from "@/lib/vault/data";
import type { Ownership } from "@/lib/vault/schema";
import { CloseSquare, MagicStar } from "@/components/icons";
import { VoiceRecorder, type SpokenMeta } from "./voice-recorder";

const OWN: { id: Ownership; label: string; hint: string }[] = [
  { id: "did", label: "I did it", hint: "Your own work" },
  { id: "helped", label: "I helped", hint: "Part of a team" },
  { id: "led", label: "I led it", hint: "You were in charge" },
];

/** One achievement in the user's own words. The words are the source the CV is checked against. */
export function ItemForm({ roleId, item, onDone }: { roleId: string; item?: VaultItem; onDone?: () => void }) {
  const [added, setAdded] = useState(0);
  const [own, setOwn] = useState<Ownership>(item?.ownership ?? "did");
  const [text, setText] = useState(item?.text ?? "");
  // What they said out loud, kept as the source, and the tidied line it became (D-125).
  const [voice, setVoice] = useState<{ spoken: string; tidied: string; showing: "tidied" | "spoken" } | null>(null);
  const [state, action] = useActionState<VaultActionState, FormData>(async (prev, fd) => {
    const res = await saveItem(prev, fd);
    if (res?.ok) {
      // Editing closes; adding stays open for the next one, one at a time.
      if (item) onDone?.();
      else {
        setAdded((n) => n + 1);
        setText("");
        setOwn("did");
        setVoice(null);
      }
    }
    return res;
  }, undefined);
  const hasNumber = /\d/.test(text);

  const close = () => onDone?.();

  return (
    <form
      action={action}
      className="space-y-3"
      noValidate
      onKeyDown={(e) => {
        if (e.key === "Escape" && onDone) {
          e.preventDefault();
          close();
        }
      }}
    >
      {!item ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink-900">{added ? `${added} added` : "Add achievements"}</p>
          {onDone ? (
            <button type="button" onClick={close} aria-label="Close and stop adding" className="grid size-10 place-items-center rounded-lg border border-ink-150 bg-white text-ink-600 transition-colors hover:bg-ink-75 hover:text-ink-900">
              <CloseSquare size={18} />
            </button>
          ) : null}
        </div>
      ) : null}
      <FormError message={state?.error} />
      <input type="hidden" name="role_id" value={roleId} />
      {item ? <input type="hidden" name="item_id" value={item.id} /> : null}
      {voice ? <input type="hidden" name="spoken" value={voice.spoken} /> : null}
      {!item ? (
        <p className="rounded-xl bg-ink-50 px-3 py-2 text-[0.8125rem] leading-5 text-ink-700">
          {added ? `Added ${added}. Add the next one, or tap Done.` : "One achievement at a time. Each one becomes one line on your CV."}
        </p>
      ) : null}
      <label htmlFor={`t-${item?.id ?? roleId}`} className="block text-sm font-semibold text-ink-900">
        {item ? "What did you do, and what changed?" : `Achievement ${added + 1}: what did you do, and what changed?`}
      </label>
      <textarea
        id={`t-${item?.id ?? roleId}`}
        name="text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="For example: Opened about 15 customer accounts a day and checked each customer's documents."
        className={`${outlinedInputClass} resize-y py-3 leading-6`}
      />
      <VoiceRecorder
        compact
        polish={{ roleId }}
        onText={(t, meta?: SpokenMeta) => {
          const joined = text.trim() ? `${text.trim()} ${t}` : t;
          setText(joined);
          if (meta) setVoice((v) => ({ spoken: v ? `${v.spoken} ${meta.spoken}` : meta.spoken, tidied: joined, showing: "tidied" }));
        }}
      />
      {voice && voice.spoken !== voice.tidied ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ink-50 px-3 py-2 text-[0.8125rem] leading-5 text-ink-700">
          <MagicStar size={16} variant="bulk" className="shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1">{voice.showing === "tidied" ? "We wrote this up from what you said. Check it says what you did." : "These are your exact words."}</span>
          <button
            type="button"
            onClick={() => {
              const next = voice.showing === "tidied" ? "spoken" : "tidied";
              setText(next === "spoken" ? voice.spoken : voice.tidied);
              setVoice({ ...voice, showing: next });
            }}
            className="min-h-9 rounded-lg px-2 font-semibold text-brand-700 hover:bg-brand-50"
          >
            {voice.showing === "tidied" ? "Use my exact words" : "Use the tidied version"}
          </button>
        </div>
      ) : null}
      {text.length > 10 && !hasNumber ? (
        <p className="text-xs text-care-700">Add a number if you can: how many, how often, how much. A rough number is fine; write &ldquo;about&rdquo;.</p>
      ) : null}
      <fieldset>
        <legend className="text-sm font-semibold text-ink-900">Your part in it</legend>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-ink-75 p-1">
          {OWN.map((o) => (
            <label
              key={o.id}
              className="flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-xl px-1 text-center text-sm font-medium text-ink-600 transition-all has-[:checked]:bg-white has-[:checked]:font-semibold has-[:checked]:text-ink-900 has-[:checked]:shadow-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500"
            >
              <input type="radio" name="ownership" value={o.id} checked={own === o.id} onChange={() => setOwn(o.id)} className="sr-only" />
              {o.label}
              <span className="text-[0.6875rem] font-normal text-ink-500">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton size="sm" pendingLabel="Saving" inactive={text.trim().length < 8}>
          {item ? "Save" : added ? "Add this one too" : "Add achievement"}
        </SubmitButton>
        {onDone ? (
          <button type="button" onClick={close} className="inline-flex min-h-12 items-center rounded-2xl px-4 text-sm font-semibold text-ink-700 hover:bg-ink-75">
            {item ? "Cancel" : added ? "Done" : "Cancel"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
