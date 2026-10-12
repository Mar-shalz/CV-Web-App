import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getApplication } from "@/lib/applications/data";
import { getShortlist, shortlistAccess } from "@/lib/shortlist/data";
import { daysUntil, logisticsFor } from "@/lib/shortlist/logistics";
import { voiceEnabled } from "@/lib/speech";
import { PRICES } from "@/lib/config";
import { formatNaira } from "@/lib/format";
import { InviteCard } from "@/components/shortlist/invite-card";
import { Logistics } from "@/components/shortlist/logistics";
import { Drill } from "@/components/shortlist/drill";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeft2, Teacher, TickCircle, Crown1, DocumentText } from "@/components/icons";

export const metadata: Metadata = { title: "Shortlist mode" };

export default async function ShortlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const app = await getApplication(viewer, id);
  if (!app) notFound();
  const access = await shortlistAccess(viewer, app.id);

  const back = (
    <Link href={`/applications/${app.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
      <ArrowLeft2 size={16} />
      {app.title}
    </Link>
  );

  if (access === "locked") {
    const boost = PRICES.products.interview_boost;
    const pass = PRICES.products.job_hunt_30d;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {back}
        <section className="animate-rise overflow-hidden rounded-[var(--radius-panel)] border border-ink-150 bg-white shadow-card">
          <div className="brand-gradient p-6 text-white">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
              <Teacher size={26} variant="bulk" />
            </span>
            <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em]">Congratulations on the invite</h1>
            <p className="mt-2 text-[0.9375rem] leading-6 text-white/85">Prepare from exactly what {app.employer} has in front of them: your CV and their post.</p>
          </div>
          <div className="p-6">
            <ul className="space-y-2.5 text-[0.9375rem] text-ink-800">
              {["Likely questions, each linked to a line on the CV you sent", "Practise out loud and get feedback that checks your answer against your CV", "A checklist for the day, by interview format"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <TickCircle size={20} variant="bulk" className="shrink-0 text-proof-600" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ButtonLink href={`/pass?product=interview_boost&application=${app.id}`} size="lg" className="cta-sheen">
                Unlock for {formatNaira(boost.amount_kobo)}
              </ButtonLink>
              <ButtonLink href="/pass" variant="secondary" size="lg">
                <Crown1 size={20} variant="bulk" />
                {pass.days} day pass, {formatNaira(pass.amount_kobo)}
              </ButtonLink>
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-500">
              {boost.label}: Shortlist mode for this one invite, paid once. The pass includes Shortlist mode for every invite and tailored CVs for {pass.days} days. Your application log and check ins stay free.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const view = await getShortlist(viewer, app);
  const days = daysUntil(view.invite.date);

  return (
    <div className="space-y-6">
      {back}
      <header className="animate-rise">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-proof-50 px-3 py-1 text-[0.8125rem] font-semibold text-proof-700">
          <Teacher size={16} variant="bulk" />
          Shortlist mode
        </p>
        <h1 className="mt-3 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Get ready for {app.employer}</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">Everything here comes from the job post you saved and the exact CV you sent. Nothing new to memorise, only your own proof to explain well.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 xl:order-1">
          <Drill applicationId={app.id} initial={view.questions} attempts={view.attempts} voice={voiceEnabled()} />
          {!view.lines.length ? (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">
              <DocumentText size={18} className="mt-0.5 shrink-0" />
              We couldn&apos;t find the CV for this application, so we can&apos;t link questions to it.
            </p>
          ) : null}
        </div>
        <aside className="order-1 space-y-5 xl:order-2">
          <InviteCard applicationId={app.id} invite={view.invite} days={days} />
          <Logistics applicationId={app.id} items={logisticsFor(view.invite.format)} done={view.invite.logisticsDone} />
        </aside>
      </div>
    </div>
  );
}
