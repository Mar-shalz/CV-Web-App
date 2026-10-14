import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { interviewRoles } from "@/lib/vault/interview-roles";
import { voiceEnabled } from "@/lib/speech";
import { InterviewFlow } from "@/components/vault/interview-flow";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Find your Wins" };

export default async function InterviewPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const viewer = await requireReadyViewer();
  const { role } = await searchParams;
  const roles = await interviewRoles(viewer);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Let&apos;s Find the Wins your CV Forgot</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">
          One question at a time about one role. Answer like you&apos;re telling a friend. Stop whenever you like; we&apos;ll pick up where you left off.
        </p>
      </header>
      <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
        {roles.length ? (
          <InterviewFlow roles={roles} voice={voiceEnabled()} initialRoleId={role} />
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-[0.9375rem] text-ink-600">Add a job, SIWES, NYSC or campus role first, then we&apos;ll ask about it.</p>
            <ButtonLink href="/experience/new">Add a role</ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
