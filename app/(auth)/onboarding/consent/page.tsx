import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/auth-shell";
import { ConsentForm } from "@/components/auth/consent-form";
import { getViewer } from "@/lib/auth/viewer";
import { LIMITS } from "@/lib/config";

export const metadata: Metadata = { title: "Your Data, your Choice" };

export default async function ConsentPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.consentDone && !viewer.preview) redirect(viewer.setupDone ? "/home" : "/onboarding/setup");

  return (
    <AuthShell step={2} title="Your Data, your Choice" subtitle="Plain words, no small print. Tick the first three to continue.">
      <ConsentForm minAge={LIMITS.onboarding.min_age_years} />
    </AuthShell>
  );
}
