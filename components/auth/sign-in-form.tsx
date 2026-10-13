"use client";

import { useActionState, useState } from "react";
import { sendEmailCode, signInWithGoogle, type FormState } from "@/app/(auth)/actions";
import { Field, TextInput } from "@/components/ui/field";
import { GoogleIcon, Sms } from "@/components/icons";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function SignInForm({ initialError, dest }: { initialError?: string; dest?: "admin" }) {
  const [googleState, googleAction] = useActionState<FormState, FormData>(signInWithGoogle, undefined);
  const [emailState, emailAction] = useActionState<FormState, FormData>(sendEmailCode, undefined);
  // Controlled, so a failed submit never wipes what the user typed.
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = EMAIL_RE.test(email.trim());
  const localError = touched && !valid ? "Enter an email address like name@gmail.com" : undefined;
  const emailError = localError ?? emailState?.fieldErrors?.email;

  return (
    <div className="space-y-6">
      <FormError message={googleState?.error ?? emailState?.error ?? initialError} />

      <form action={googleAction}>
        {dest ? <input type="hidden" name="dest" value={dest} /> : null}
        <SubmitButton variant="secondary" size="lg" className="w-full" pendingLabel="Opening Google">
          <GoogleIcon />
          Continue with Google
        </SubmitButton>
      </form>

      <div className="flex items-center gap-4 text-sm text-ink-500">
        <span className="h-px flex-1 bg-ink-150" aria-hidden="true" />
        or use your email
        <span className="h-px flex-1 bg-ink-150" aria-hidden="true" />
      </div>

      <form action={emailAction} className="space-y-5" noValidate>
        {dest ? <input type="hidden" name="dest" value={dest} /> : null}
        <Field id="email" label="Email address" error={emailError} hint="We'll email you a code and a sign in link. No password needed.">
          <TextInput
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email && setTouched(true)}
            required
            invalid={Boolean(emailError)}
            describedBy={emailError ? "email-error" : "email-hint"}
          />
        </Field>
        <SubmitButton size="lg" className="w-full" pendingLabel="Sending your code" inactive={!valid} onInactiveClick={() => setTouched(true)}>
          <Sms size={20} />
          Send me a code
        </SubmitButton>
      </form>
    </div>
  );
}
