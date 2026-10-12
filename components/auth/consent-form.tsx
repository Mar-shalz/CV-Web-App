"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { saveConsent, type FormState } from "@/app/(auth)/actions";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";
import { CheckRow } from "./check-row";

type Ticks = { adult: boolean; terms: boolean; privacy: boolean; marketing: boolean };

export function ConsentForm({ minAge }: { minAge: number }) {
  const [state, action] = useActionState<FormState, FormData>(saveConsent, undefined);
  const [ticks, setTicks] = useState<Ticks>({ adult: false, terms: false, privacy: false, marketing: false });
  const [shown, setShown] = useState<Record<string, string> | null>(null);
  const ready = ticks.adult && ticks.terms && ticks.privacy;
  const fe = shown ?? state?.fieldErrors ?? {};

  const set = (k: keyof Ticks) => (v: boolean) => {
    setTicks((t) => ({ ...t, [k]: v }));
    setShown((e) => (e ? { ...e, [k]: "" } : e));
  };

  function missing(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!ticks.adult) errs.adult = `You need to be ${minAge} or older to use this app.`;
    if (!ticks.terms) errs.terms = "Tick this box to agree to the terms.";
    if (!ticks.privacy) errs.privacy = "Tick this box to agree to the privacy notice.";
    return errs;
  }

  // Same rules as the server action, checked first so ticked boxes stay ticked.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const errs = missing();
    if (Object.keys(errs).length) {
      e.preventDefault();
      setShown(errs);
    }
  }

  const doc = (href: string, label: string) => (
    <Link href={href} target="_blank" className="text-brand-700 underline underline-offset-2">
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormError message={state?.error} />
      <fieldset className="space-y-3">
        <legend className="sr-only">Agreements</legend>
        <CheckRow name="adult" title={`I'm ${minAge} or older`} required error={fe.adult} checked={ticks.adult} onChange={set("adult")} />
        <CheckRow name="terms" required error={fe.terms} checked={ticks.terms} onChange={set("terms")} title={<>I agree to the {doc("/legal/terms", "Terms of use")}</>}>
          You always send applications yourself. We never contact employers for you.
        </CheckRow>
        <CheckRow
          name="privacy"
          required
          error={fe.privacy}
          checked={ticks.privacy}
          onChange={set("privacy")}
          title={<>I agree to the {doc("/legal/privacy", "Privacy notice")}</>}
        >
          We never sell your data. Some of it is processed outside Nigeria. You can download or delete it at any time.
        </CheckRow>
        <CheckRow name="marketing" title="Send me job hunting tips" checked={ticks.marketing} onChange={set("marketing")}>
          Up to twice a month. Unsubscribe whenever you like.
        </CheckRow>
      </fieldset>

      <div className="pt-4">
        <SubmitButton size="lg" className="w-full" pendingLabel="Saving your choices" inactive={!ready} onInactiveClick={() => setShown(missing())}>
          Agree and continue
        </SubmitButton>
      </div>
    </form>
  );
}
