import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getJob } from "@/lib/jobs/data";
import { getLatestCv } from "@/lib/cv/data";
import { ensurePack } from "@/lib/applications/pack";
import { getApplicationForJob } from "@/lib/applications/data";
import { createClient } from "@/lib/supabase/server";
import { FlowSteps } from "@/components/flow/flow-steps";
import { SendPack } from "@/components/flow/send-pack";
import { CHANNEL_LABELS } from "@/lib/jobs/labels";

// The email and cover letter writer may run twice, with the most thinking (D-186, round 28).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Send your Application" };

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const job = await getJob(viewer, id);
  const cv = await getLatestCv(viewer, job.id);
  if (!cv) redirect(`/jobs/${job.id}/cv`);

  if (!viewer.preview) {
    const supabase = await createClient();
    const { data: v } = await supabase.from("verdicts").select("gaps").eq("job_id", job.id).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const gap = ((v?.gaps ?? []) as { gap: string; addressIn: string; how: string }[]).find((g) => g.addressIn === "email");
    const res = await ensurePack(viewer, job, cv, gap ? `${gap.gap}. ${gap.how}` : null);
    if ("error" in res) throw new Error(res.error);
  }
  const app = await getApplicationForJob(viewer, job.id);
  if (!app?.pack) throw new Error("No pack");
  const channel = app.pack.channel;

  return (
    <div className="space-y-3">
      <FlowSteps current="send" hrefs={{ add: `/jobs/${job.id}`, check: `/jobs/${job.id}/check`, cv: `/jobs/${job.id}/cv` }} back={`/jobs/${job.id}/cv`} />
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Ready to Send</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">
          {channel === "email"
            ? "This employer wants applications by email. Here's everything they asked for, in the format they asked for it."
            : channel === "form"
              ? "This employer uses an online form. Here's what it asks for, and your CV ready to upload."
              : `This employer takes applications ${CHANNEL_LABELS[channel].toLowerCase()}. Here are the steps, and your CV ready to upload.`}
        </p>
      </header>
      <SendPack key={app.pack.id} pack={app.pack} applicationId={app.id} cvId={cv.id} jobId={job.id} alreadySent={app.status !== "draft" && app.status !== "packed"} />
    </div>
  );
}
