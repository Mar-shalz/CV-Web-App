"use client";

import { useActionState, useState } from "react";
import { joinWaitlist, priceClicked, type WaitlistState } from "@/app/landing-actions";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { TickCircle } from "@/components/icons";

/** Fake door price button plus waitlist (Slice 0, Gate 1). */
export function PriceDoor({ label, product }: { label: string; product: string }) {
  const [opened, setOpened] = useState(false);
  if (opened) return <Waitlist source="price_button" intro="We're opening in small batches. Leave your email and you'll be in the first one." />;
  return (
    <Button
      size="lg"
      className="w-full"
      onClick={() => {
        setOpened(true);
        void priceClicked(product);
      }}
    >
      {label}
    </Button>
  );
}

export function Waitlist({ source, intro }: { source: string; intro?: string }) {
  const [state, action] = useActionState<WaitlistState, FormData>(joinWaitlist, undefined);
  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-2.5 rounded-2xl bg-proof-50 p-4 text-[0.9375rem] font-medium leading-6 text-proof-700">
        <TickCircle size={20} variant="bulk" className="mt-0.5 shrink-0" />
        You&apos;re on the list. We&apos;ll email you when your spot opens.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3" noValidate>
      {intro ? <p className="text-sm leading-6 text-ink-600">{intro}</p> : null}
      <input type="hidden" name="source" value={source} />
      <label htmlFor={`wl-${source}`} className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <TextInput
          id={`wl-${source}`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@gmail.com"
          invalid={Boolean(state?.error)}
          describedBy={state?.error ? `wl-${source}-error` : undefined}
        />
        <SubmitButton className="shrink-0" pendingLabel="Adding you">
          Join the waitlist
        </SubmitButton>
      </div>
      {state?.error ? (
        <p id={`wl-${source}-error`} role="alert" className="text-[0.8125rem] font-medium text-flag-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
