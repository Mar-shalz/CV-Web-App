import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/shell/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Lock1 } from "@/components/icons";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; to?: string }> }) {
  const { error, to } = await searchParams;
  return (
    <AuthShell step={1} title="Let's get you started" subtitle="Sign in or create an account. It takes less than a minute.">
      <SignInForm
        dest={to === "admin" ? "admin" : undefined}
        initialError={
          error === "google"
            ? "Google sign in didn't finish. Try again, or use your email instead."
            : error === "link"
              ? "That sign in link has expired or was opened on a different device. Ask for a new one here."
              : undefined
        }
      />

      <p className="mt-8 flex items-start justify-center gap-2 text-center text-[0.8125rem] leading-5 text-ink-500">
        <Lock1 size={16} className="mt-0.5 shrink-0" />
        <span>
          Your details stay private. We never apply or contact employers for you.{" "}
          <Link href="/legal/privacy" className="font-medium text-brand-700 underline-offset-2 hover:underline">
            How we protect your data
          </Link>
        </span>
      </p>
    </AuthShell>
  );
}
