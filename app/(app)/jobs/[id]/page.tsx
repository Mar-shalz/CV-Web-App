import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { FlowSteps } from "@/components/flow/flow-steps";
import { ComingNext } from "@/components/shell/coming-next";
import { ShieldSearch } from "@/components/icons";

export const metadata: Metadata = { title: "Job saved" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  if (id === "demo") {
    if (viewer.preview) redirect("/jobs/demo/check");
    notFound();
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, source_type, captured_at").eq("id", id).eq("user_id", viewer.id).maybeSingle();
  if (!job) notFound();

  return (
    <div className="space-y-6">
      <FlowSteps current="check" />
      <ComingNext
        title="Job saved"
        intro={`Added ${formatDate(job.captured_at)}. Your job is safe in your account.`}
        slice="Slices 3 and 4"
        icon={<ShieldSearch size={22} variant="bulk" />}
        points={[
          "Reading the job automatically: title, employer, deadline and how to apply.",
          "Checking hard requirements and scam signs, then an honest apply, apply with care or skip.",
          "Until then, the full flow is visible in the design preview.",
        ]}
      />
    </div>
  );
}
