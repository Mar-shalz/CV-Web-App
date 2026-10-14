import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SubmitButton } from "@/components/auth/submit-button";
import { getStaff, getAdminUser } from "@/lib/admin/auth";
import { switchAdminAccount } from "./actions";
import { Warning2 } from "@/components/icons";

export const metadata: Metadata = { title: "Back Office Sign In", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  google: "Google sign in didn't finish. Try again, or use your email instead.",
  link: "That sign in link has expired or was opened on a different device. Ask for a new one here.",
};

/**
 * The back office's own sign in (D-127, D-136). It has its own session, separate from
 * the app's. Team members already signed in here go straight in; someone signed in here
 * with an account that isn't on the team can switch.
 */
export default async function AdminSignIn({ searchParams }: { searchParams: Promise<{ error?: string; signed_out?: string }> }) {
  const { error, signed_out } = await searchParams;
  const viewer = signed_out ? null : await getAdminUser();
  if (viewer) {
    if (await getStaff()) redirect("/admin");
    return (
      <AdminAuthShell title="Back Office Sign In">
        <div className="space-y-4">
          <p className="flex items-start gap-2.5 rounded-2xl bg-care-50 p-4 text-sm leading-6 text-care-700">
            <Warning2 size={20} variant="bulk" className="mt-0.5 shrink-0" />
            <span>
              You&apos;re signed in as <span className="font-semibold">{viewer.email}</span>, which doesn&apos;t have back office access. Sign in with your team account instead.
            </span>
          </p>
          <form action={switchAdminAccount}>
            <SubmitButton size="lg" className="w-full" pendingLabel="Signing out">
              Use my team account
            </SubmitButton>
          </form>
        </div>
      </AdminAuthShell>
    );
  }

  return (
    <AdminAuthShell title="Back Office Sign In" subtitle="For the team only. Use the account you were added with. You'll confirm with your authenticator app next. This is separate from the app: signing in here doesn't sign you in to the app.">
      <SignInForm dest="admin" initialError={error ? ERRORS[error] : undefined} />
    </AdminAuthShell>
  );
}
