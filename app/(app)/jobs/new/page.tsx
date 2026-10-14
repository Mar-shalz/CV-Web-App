import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getHomeData } from "@/lib/home-data";
import { LIMITS } from "@/lib/config";
import { FlowSteps } from "@/components/flow/flow-steps";
import { CaptureForm } from "@/components/flow/capture-form";
import { Briefcase, ShieldSearch, Magicpen, Send2, Danger, ArrowRight } from "@/components/icons";

export const metadata: Metadata = { title: "Tailor My CV" };

const NEXT = [
  { icon: ShieldSearch, title: "We check the job", body: "Hard requirements like class of degree, NYSC and age, plus signs of a scam." },
  { icon: Magicpen, title: "We tailor your CV", body: "Reworded to match the job, in the format the employer expects. Nothing made up." },
  { icon: Send2, title: "You send it", body: "We give you the exact email subject and message. You send it from your phone." },
];

export default async function CaptureJobPage({ searchParams }: { searchParams: Promise<{ via?: string; error?: string }> }) {
  const viewer = await requireReadyViewer();
  const { via, error } = await searchParams;
  const initialError =
    error === "share" ? "We couldn't read what you shared. Paste the job text or add a screenshot instead." : error === "busy" ? "You've added a lot of jobs in the last hour. Try again soon." : undefined;
  const data = await getHomeData(viewer);
  const target = LIMITS.onboarding.vault_ready_items;
  const short = data.stats.vaultConfirmed < target;
  const initial = via === "link" || via === "file" || via === "screenshot" ? via : "paste";

  return (
    <div className="space-y-3">
      <FlowSteps current="add" back="/applications" />
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Tailor Your CV to a Job</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">
          Start with the job description. The more complete it is, the better your CV will match.{" "}
          <Link href="/jobs/real" className="font-semibold text-brand-700 hover:underline">
            Only want to check if a job is real?
          </Link>
        </p>
      </header>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
          <CaptureForm initialMode={initial} initialError={initialError} />
        </section>

        <aside className="space-y-3">
          {short ? (
            <div className="rounded-[var(--radius-card)] border border-care-100 bg-care-50 p-5">
              <p className="flex items-center gap-2 font-semibold text-care-700">
                <Danger size={20} variant="bulk" />
                Add your experience first
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-5 text-care-700">
                Your CV is written only from what you tell us. You have {data.stats.vaultConfirmed} of {target} items. Add a few more for a stronger CV.
              </p>
              <Link href="/experience" className="mt-3 inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-care-700 underline-offset-2 hover:underline">
                Add experience
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-proof-100 bg-proof-50 p-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-proof-700">
                <Briefcase size={22} variant="bulk" />
              </span>
              <p className="text-[0.8125rem] leading-5 text-proof-700">
                <span className="font-semibold">{data.stats.vaultConfirmed} experience items ready.</span> Every CV line will come from these.
              </p>
            </div>
          )}

          <section aria-labelledby="next-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
            <h2 id="next-title" className="text-[0.9375rem] font-semibold text-ink-900">
              What Happens Next
            </h2>
            <ol className="mt-4 space-y-4">
              {NEXT.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative flex gap-3">
                  {i < NEXT.length - 1 ? <span className="absolute left-[21px] top-12 h-[calc(100%-28px)] w-px bg-ink-150" aria-hidden="true" /> : null}
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <Icon size={22} variant="bulk" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{title}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-600">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
