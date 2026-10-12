"use client";

import { useActionState, useState, useTransition } from "react";
import { startEnrol, verifyMfa, type MfaState } from "@/app/admin/mfa/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError } from "@/components/auth/form-error";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function MfaForm({ factorId: existing }: { factorId: string | null }) {
  const [state, action] = useActionState<MfaState, FormData>(verifyMfa, undefined);
  const [enrol, setEnrol] = useState<MfaState>(undefined);
  const [busy, start] = useTransition();
  const [code, setCode] = useState("");
  const factorId = existing ?? enrol?.enroll?.factorId ?? null;

  if (!factorId) {
    return (
      <div className="space-y-4">
        <FormError message={enrol?.error} />
        <p className="text-[0.9375rem] leading-6 text-ink-600">
          Staff accounts need an authenticator app, like Google Authenticator or Microsoft Authenticator. It takes about a minute.
        </p>
        <Button size="lg" className="w-full" disabled={busy} onClick={() => start(async () => setEnrol(await startEnrol()))}>
          {busy ? "Starting" : "Set up two factor sign in"}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <FormError message={state?.error} />
      {enrol?.enroll ? (
        <div className="rounded-2xl bg-ink-50 p-4 text-center">
          {/* QR code is an SVG data URI returned by Supabase Auth, not user content. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrol.enroll.qr} alt="QR code to add this account to your authenticator app" width={180} height={180} className="mx-auto rounded-xl bg-white p-2" />
          <p className="mt-3 text-xs text-ink-600">Can&apos;t scan? Enter this key in the app:</p>
          <p className="mt-1 break-all font-mono text-sm text-ink-900">{enrol.enroll.secret}</p>
        </div>
      ) : null}
      <input type="hidden" name="factor_id" value={factorId} />
      <div>
        <label htmlFor="mfa-code" className="text-sm font-semibold text-ink-900">
          6 digit code from your app
        </label>
        <input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${inputClass} mt-2 text-center text-2xl font-semibold tracking-[0.5em]`}
        />
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel="Checking" inactive={code.replace(/\D/g, "").length !== 6}>
        Verify and open the back office
      </SubmitButton>
    </form>
  );
}
