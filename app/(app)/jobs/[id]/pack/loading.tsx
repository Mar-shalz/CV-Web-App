import { WorkingNotice } from "@/components/ui/working-notice";

// The first visit writes the email (and a cover letter when the job asks): a focused writer
// that can take 10 to 30 seconds (D-188). Later visits open straight away.
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl pt-6">
      <WorkingNotice title="Writing your application email" steps={["Reading what the employer asked for", "Picking your strongest proof for this job", "Writing your email", "Checking every fact against your CV"]} estimate="Usually 10 to 30 seconds" stepSeconds={6} />
    </div>
  );
}
