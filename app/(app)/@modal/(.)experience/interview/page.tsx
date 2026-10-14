import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { interviewRoles } from "@/lib/vault/interview-roles";
import { voiceEnabled } from "@/lib/speech";
import { RouteModal } from "@/components/ui/route-modal";
import { MODAL_ROUTES } from "@/components/ui/modal-routes";
import { InterviewFlow } from "@/components/vault/interview-flow";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Find your Wins" };

export default async function InterviewModal({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const viewer = await requireReadyViewer();
  const { role } = await searchParams;
  const roles = await interviewRoles(viewer);
  return (
    <RouteModal {...MODAL_ROUTES["/experience/interview"]}>
      {roles.length ? (
        <InterviewFlow roles={roles} voice={voiceEnabled()} initialRoleId={role} />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-[0.9375rem] text-ink-600">Add a job, SIWES, NYSC or campus role first, then we&apos;ll ask about it.</p>
          <ButtonLink href="/experience/new">Add a role</ButtonLink>
        </div>
      )}
    </RouteModal>
  );
}
