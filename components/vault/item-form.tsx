"use client";

import { useActionState, useState } from "react";
import { saveItem, type VaultActionState } from "@/app/(app)/vault/actions";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import type { VaultItem } from "@/lib/vault/data";
import type { Ownership } from "@/lib/vault/schema";

const OWN: { id: Ownership; label: string; hint: string }[] = [
  { id: "did", label: "I did it", hint: "Your own work" },
  { id: "helped", label: "I helped", hint: "Part of a team" },
  { id: "led", label: "I led it", hint: "You were in charge" },
];

/** One achievement in the user's own words. The words are the source the CV is checked against. */
export function ItemForm({ roleId, item, onDone }: { roleId: string; item?: VaultItem; onDone?: () => void }) {
  const [state, action] = useActionState<VaultActionState, FormData>(async (prev, fd) => {
    const res = await saveItem(prev, fd);
    if (res?.ok) onDone?.();
    return res;
  }, undefined);
  const [own, setOwn] = useState<Ownership>(item?.ownership ?? "did");
  const [text, setText] = useState(item?.text ?? "");
  const hasNumber = /\d/.test(text);

  return (
    <form action={action} className="space-y-3" noValidate>
      <FormError message={state?.error} />
      <input type="hidden" name="role_id" value={roleId} />
      {item ? <input type="hidden" name="item_id" value={item.id} /> : null}
      <label htmlFor={`t-${item?.id ?? roleId}`} className="block text-sm font-semibold text-ink-900">
        What did you do, and what changed?
      </label>
      <textarea
        id={`t-${item?.id ?? roleId}`}
        name="text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="For example: Opened about 15 customer accounts a day and checked each customer's documents."
        className={`${inputClass} resize-y py-3 leading-6`}
      />
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
      <SubmitButton size="sm" pendingLabel="Saving" inactive={text.trim().length < 8}>
        {item ? "Save" : "Add achievement"}
      </SubmitButton>
    </form>
  );
}
