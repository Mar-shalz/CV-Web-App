import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { SubmitButton } from "@/components/auth/submit-button";
import { signOut } from "@/app/(auth)/actions";
import { getViewer } from "@/lib/auth/viewer";
import { APP } from "@/lib/config";
import { Lock1 } from "@/components/icons";

export const metadata: Metadata = { title: "Account paused", robots: { index: false, follow: false } };

/** Where a paused account lands. Plain words, a way to ask why, and a way out. */
export default async function SuspendedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.suspended) redirect("/home");

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-panel)] border border-ink-150 bg-white p-6 text-center shadow-card lg:p-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mt-6 grid size-14 place-items-center rounded-2xl bg-care-50 text-care-700">
          <Lock1 size={28} variant="bulk" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900">Your account is paused</h1>
        <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
          You can&apos;t use the app with this account for now. Your experience and CVs are kept safe. If you think this is a mistake, email{" "}
          <a href={`mailto:${APP.support_email}`} className="font-semibold text-brand-700 underline underline-offset-2">
            {APP.support_email}
          </a>
          .
        </p>
        <form action={signOut} className="mt-6">
          <SubmitButton variant="secondary" size="lg" className="w-full" pendingLabel="Signing out">
            Sign out
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
