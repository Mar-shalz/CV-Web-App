"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startPayment, type PayState } from "@/app/(app)/pass/actions";
import { Danger, Lock1 } from "@/components/icons";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";

function Submit({ label, variant }: { label: string; variant: ButtonVariant }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass(variant, "lg", `w-full ${variant === "primary" ? "cta-sheen" : ""}`)}>
      <Lock1 size={20} variant="bulk" />
      {pending ? "Opening Paystack…" : label}
    </button>
  );
}

/** Pay with Paystack: card, bank transfer or USSD. The secret key stays on the server. */
export function PayButton({ product, application, label, variant = "primary" }: { product: "job_hunt_30d" | "interview_boost" | "cv_topup"; application?: string | null; label: string; variant?: ButtonVariant }) {
  const [state, action] = useActionState<PayState, FormData>(startPayment, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="product" value={product} />
      {application ? <input type="hidden" name="application" value={application} /> : null}
      <Submit label={label} variant={variant} />
      {state?.error ? (
        <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-flag-700">
          <Danger size={18} className="mt-px shrink-0" />
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
