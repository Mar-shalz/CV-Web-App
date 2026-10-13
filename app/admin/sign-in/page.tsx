import type { Metadata } from "next";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Back office sign in", robots: { index: false, follow: false } };

export default async function AdminSignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AdminAuthShell title="Staff sign in" subtitle="Use the email or Google account on the team list. Next, you confirm with the code from your authenticator app.">
      <SignInForm
        dest="admin"
        initialError={
          error === "google"
            ? "Google sign in didn't finish. Try again, or use your email instead."
            : error === "link"
              ? "That sign in link has expired or was opened on a different device. Ask for a new one here."
              : undefined
        }
      />
    </AdminAuthShell>
  );
}
