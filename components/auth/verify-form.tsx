"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { resendEmailCode, verifyEmailCode, type FormState } from "@/app/(auth)/actions";
import { Field, inputClass } from "@/components/ui/field";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

export function VerifyForm({ codeLength, resendSeconds }: { codeLength: number; resendSeconds: number }) {
  const [state, action] = useActionState<FormState, FormData>(verifyEmailCode, undefined);
  const [left, setLeft] = useState(resendSeconds);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const digits = code.replace(/\D/g, "");
  const complete = digits.length === codeLength;
  const codeError = (touched && !complete ? `Enter all ${codeLength} digits from the email.` : undefined) ?? state?.fieldErrors?.code;

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  function resend() {
    setResendMsg(null);
    startResend(async () => {
      const res = await resendEmailCode();
      if (res?.error) setResendMsg(res.error);
      else {
        setResendMsg("We sent a new code. Check your inbox and spam folder.");
        setLeft(resendSeconds);
      }
    });
  }

  return (
    <div className="space-y-6">
      <FormError message={state?.error} />
      <form action={action} className="space-y-5" noValidate>
        <Field id="code" label="Verification code" error={codeError}>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={codeLength + 2}
            required
            autoFocus
            placeholder={"•".repeat(codeLength)}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? "code-error" : undefined}
            className={`${inputClass} min-h-16 text-center font-display text-[1.75rem] font-semibold tracking-[0.6em] placeholder:tracking-[0.6em] placeholder:text-ink-300`}
          />
        </Field>
        <SubmitButton size="lg" className="w-full" pendingLabel="Checking your code" inactive={!complete} onInactiveClick={() => setTouched(true)}>
          Verify and continue
        </SubmitButton>
      </form>

      <div className="text-center text-sm text-ink-600" aria-live="polite">
        {left > 0 ? (
          <p>
            Didn&apos;t get it? Resend in <span className="font-semibold tabular-nums text-ink-900">{left}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="min-h-12 rounded-xl px-3 font-semibold text-brand-700 underline-offset-4 hover:underline disabled:text-ink-400"
          >
            {resending ? "Sending a new code" : "Resend code"}
          </button>
        )}
        {resendMsg ? <p className="mt-2 text-ink-600">{resendMsg}</p> : null}
      </div>
    </div>
  );
}
