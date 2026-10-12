import type { Metadata } from "next";
import { requireDemoJob } from "@/lib/demo/guard";
import { DEMO_CV, DEMO_JOB } from "@/lib/demo/job";
import { FlowSteps } from "@/components/flow/flow-steps";
import { CvEditor } from "@/components/flow/cv-editor";

export const metadata: Metadata = { title: "Your tailored CV" };

export default async function CvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireDemoJob(id);
  return (
    <div className="space-y-6">
      <FlowSteps current="cv" hrefs={{ add: "/jobs/new", check: "/jobs/demo/check" }} />
      <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Your tailored CV</h1>
          <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">
            For {DEMO_JOB.title} at {DEMO_JOB.employer}. Written only from your experience, in the {DEMO_JOB.destination.format.toLowerCase()} format.
          </p>
        </div>
      </header>
      <CvEditor cv={DEMO_CV} nextHref="/jobs/demo/pack" />
    </div>
  );
}
