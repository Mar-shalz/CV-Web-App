"use client";

import type { FormEvent } from "react";
import { priceClicked } from "@/app/landing-actions";
import { SubmitButton } from "@/components/auth/submit-button";

function visitorId(): string {
  try {
    let id = localStorage.getItem("rcpt_visitor");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("rcpt_visitor", id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * The price button: records the tap as willingness to pay, then opens sign in. A random
 * id kept in this browser stops one person's repeat taps counting many times.
 */
export function PriceDoor({ label, product }: { label: string; product: string }) {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("visitor");
    if (input instanceof HTMLInputElement) input.value = visitorId();
  }
  return (
    <form action={priceClicked} onSubmit={onSubmit}>
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="visitor" defaultValue="" />
      <SubmitButton size="lg" className="w-full" pendingLabel="Opening sign in">
        {label}
      </SubmitButton>
    </form>
  );
}
