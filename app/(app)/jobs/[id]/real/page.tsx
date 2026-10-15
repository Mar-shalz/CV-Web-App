import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getJob } from "@/lib/jobs/data";
import { quickCheck, savedCheck } from "@/lib/legitimacy";
import { createClient } from "@/lib/supabase/server";
import { ScamCheck } from "@/components/flow/scam-check";
import { buttonClass } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Building, Location, Magicpen, ShieldSearch } from "@/components/icons";

export const metadata: Metadata = { title: "Is This Job Real?" };

export default async function JobRealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const job = await getJob(viewer, id);
  const p = job.parsed;
  const quick = quickCheck(job.rawText ?? "", p);
  const saved = viewer.preview ? null : await savedCheck(await createClient(), job.id, job.rawText ?? "", p);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link href="/jobs/real" className="-ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-1.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-75 hover:text-ink-900">
        <ArrowLeft size={18} />
        Check another job
      </Link>
      <header className="animate-rise rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">The job you checked</p>
        <h1 className="mt-1 font-display text-[1.5rem] font-semibold leading-8 tracking-[-0.02em] text-ink-900">{p.title ?? "Untitled job"}</h1>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-600">
          <li className="flex items-center gap-1.5">
            <Building size={18} />
            {p.employer_name ?? "Company not named"}
          </li>
          {p.location.city || p.location.country ? (
            <li className="flex items-center gap-1.5">
              <Location size={18} />
              {[p.location.city, p.location.state].filter(Boolean).join(", ") || p.location.country}
            </li>
          ) : null}
        </ul>
      </header>
      <ScamCheck jobId={job.id} initial={saved ?? quick} ready={Boolean(saved)} large title={job.parsed.title} employer={job.parsed.employer_name} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/jobs/${job.id}`} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
          <Magicpen size={20} variant="bulk" />
          Tailor my CV to this job
          <ArrowRight size={18} />
        </Link>
        <Link href="/jobs/real" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
          <ShieldSearch size={20} />
          Check another job
        </Link>
      </div>
    </div>
  );
}
