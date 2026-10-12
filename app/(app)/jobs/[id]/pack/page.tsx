import type { Metadata } from "next";
import { requireDemoJob } from "@/lib/demo/guard";
import { DEMO_PACK } from "@/lib/demo/job";
import { FlowSteps } from "@/components/flow/flow-steps";
import { SendPack } from "@/components/flow/send-pack";

export const metadata: Metadata = { title: "Send your application" };

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireDemoJob(id);
  return (
    <div className="space-y-6">
      <FlowSteps current="send" hrefs={{ add: "/jobs/new", check: "/jobs/demo/check", cv: "/jobs/demo/cv" }} />
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Ready to send</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">This employer asked for applications by email. Here&apos;s everything they asked for, in the format they asked for it.</p>
      </header>
      <SendPack pack={DEMO_PACK} />
    </div>
  );
}
