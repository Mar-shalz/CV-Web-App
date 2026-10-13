import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getJob } from "@/lib/jobs/data";
import { FlowSteps } from "@/components/flow/flow-steps";
import { JobReviewForm } from "@/components/flow/job-review-form";
import { PROFILE_LABELS } from "@/lib/rules/destination";
import { MARKETS } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { Danger, DocumentText } from "@/components/icons";

export const metadata: Metadata = { title: "Check the details" };

export default async function JobReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const job = await getJob(viewer, id);
  const manual = job.parseStatus === "manual";

  return (
    <div className="space-y-3">
      <FlowSteps current="add" hrefs={{}} />
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">
          {manual ? "Fill in the job details" : "Check the details we found"}
        </h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">
          {manual
            ? "We couldn't read this job automatically. Fill in what you can see; the title and how to apply matter most."
            : "Fix anything we got wrong. The email address and subject line matter most: they decide whether your application arrives."}
        </p>
      </header>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
          {manual ? (
            <p className="mb-5 flex items-start gap-2 rounded-2xl bg-care-50 p-3.5 text-sm text-care-700">
              <Danger size={20} variant="bulk" className="mt-px shrink-0" />
              Automatic reading didn&apos;t work for this one. Your post is saved; the original is on the right.
            </p>
          ) : null}
          <JobReviewForm
            jobId={job.id}
            job={job.parsed}
            destination={job.destination.country}
            ask={job.destination.ask}
            alternatives={job.destination.alternatives}
            profileLabel={PROFILE_LABELS[job.destination.profile]}
            fallbackNote={job.destination.fallbackNote}
            countries={MARKETS.countries.map((c) => ({ code: c.code, label: c.label }))}
            manual={manual}
          />
        </section>

        <aside className="space-y-3 xl:sticky xl:top-28 xl:self-start">
          <section className="torn-edge rounded-t-[var(--radius-card)] bg-paper p-5 shadow-card">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
              <DocumentText size={16} />
              The original post
            </p>
            <p className="mt-1 text-xs text-ink-500">Saved {formatDate(job.capturedAt)}. We keep this copy even if the advert is taken down.</p>
            {job.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.imageUrl} alt="Screenshot of the job post" className="mt-3 w-full rounded-xl border border-paper-edge" />
            ) : job.rawText ? (
              <p className="mt-3 max-h-[480px] overflow-y-auto whitespace-pre-line text-[0.8125rem] leading-5 text-ink-700">{job.rawText}</p>
            ) : job.sourceUrl ? (
              <p className="mt-3 break-all text-sm text-ink-700">{job.sourceUrl}</p>
            ) : (
              <p className="mt-3 text-sm text-ink-500">From a file you uploaded.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
