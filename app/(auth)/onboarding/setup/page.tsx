import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/auth-shell";
import { SetupForm } from "@/components/auth/setup-form";
import { getViewer } from "@/lib/auth/viewer";
import { MARKETS } from "@/lib/config";
import { regionOf } from "@/lib/markets";

export const metadata: Metadata = { title: "Set up your job search" };

export default async function SetupPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!viewer.consentDone) redirect("/onboarding/consent");
  const editing = viewer.setupDone;

  return (
    <AuthShell
      step={3}
      title={editing ? "Your job search" : "Set up your job search"}
      subtitle={editing ? "Change where you're applying or your stage. New CVs use it straight away." : "This helps us format your CV the way employers expect. You can change it later."}
    >
      <SetupForm
        stages={MARKETS.career_stages}
        regions={MARKETS.regions}
        initial={{ stage: viewer.careerStage, region: regionOf(viewer.targetMarkets), lowData: viewer.lowDataMode }}
        submitLabel={editing ? "Save changes" : "Finish setup"}
      />
    </AuthShell>
  );
}
