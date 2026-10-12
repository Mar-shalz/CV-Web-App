import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/auth-shell";
import { SetupForm } from "@/components/auth/setup-form";
import { getViewer } from "@/lib/auth/viewer";
import { LIMITS, MARKETS } from "@/lib/config";

export const metadata: Metadata = { title: "Set up your job search" };

export default async function SetupPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.consentDone) redirect("/onboarding/consent");

  return (
    <AuthShell step={3} title="Set up your job search" subtitle="This helps us format your CV the way employers expect. You can change it later.">
      <SetupForm stages={MARKETS.career_stages} regions={MARKETS.regions} countries={MARKETS.countries} maxCountries={LIMITS.onboarding.max_target_countries} />
    </AuthShell>
  );
}
