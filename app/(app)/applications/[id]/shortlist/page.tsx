import type { Metadata } from "next";
import { clearPrepNudge } from "@/lib/notifications/data";
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
import { MockInterview } from "@/components/shortlist/mock-interview";
import { WebQuestions } from "@/components/shortlist/web-questions";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeft2, Teacher, TickCircle, Crown1, DocumentText } from "@/components/icons";

export const metadata: Metadata = { title: "Interview Prep" };
// A mock interview turn reads the whole interview so far (D-189).
export const maxDuration = 300;

export default async function ShortlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const app = await getApplication(viewer, id);
  if (!app) notFound();
  // Preparing now: the "Later" reminder has done its job (D-202).
  const [access] = await Promise.all([shortlistAccess(viewer, app.id), clearPrepNudge(viewer, app.id)]);

  const back = (
    <Link href={`/applications/${app.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
      <ArrowLeft2 size={16} />
      {app.title}
    </Link>
  );

  if (access === "locked") {
    const boost = { ...PRICES.products.interview_boost, amount_kobo: viewer.pricing.boost.amountKobo };
    const pass = { ...PRICES.products.job_hunt_30d, amount_kobo: viewer.pricing.pass.amountKobo, days: viewer.pricing.pass.days };
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        {back}
        <section className="animate-rise overflow-hidden rounded-[var(--radius-panel)] border border-ink-150 bg-white shadow-card">
          <div className="brand-gradient p-6 text-white">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
              <Teacher size={26} variant="bulk" />
            </span>
            <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em]">Congratulations on the Invite</h1>
            <p className="mt-2 text-[0.9375rem] leading-6 text-white/85">Prepare from exactly what {app.employer} has in front of them: your CV and their post.</p>
          </div>
          <div className="p-6">
            <ul className="space-y-2.5 text-[0.9375rem] text-ink-800">
              {["A mock interview, one question at a time: the next question builds on your answer", "Likely questions, each linked to a line on the CV you sent", "Feedback that checks every answer against your CV", "A checklist for the day, by interview format"].map((t) => (
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
              {boost.label}: interview prep for this one invite, paid once. The pass includes interview prep for every invite and tailored CVs for {pass.days} days. Your application log and check ins stay free.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const view = await getShortlist(viewer, app);
  const days = daysUntil(view.invite.date);

  return (
    <div className="space-y-3">
      {back}
      <header className="animate-rise">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-proof-50 px-3 py-1 text-[0.8125rem] font-semibold text-proof-700">
          <Teacher size={16} variant="bulk" />
          Interview prep
        </p>
        <h1 className="mt-3 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Get Ready for {app.employer}</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">Everything here comes from the job post you saved and the exact CV you sent. Nothing new to memorise, only your own proof to explain well.</p>
      </header>

      {/* Phones: the invite, then the mock interview, then the rest. Wide screens: practice on the left, the invite and the day on the right. */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr]">
        <div className="xl:col-start-2 xl:row-start-1">
          <InviteCard applicationId={app.id} invite={view.invite} days={days} />
        </div>
        <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          {/* One question at a time, building on each answer (founder round 26, D-189). */}
          <MockInterview applicationId={app.id} initial={view.mock} voice={voiceEnabled()} />
          <Drill applicationId={app.id} initial={view.questions} attempts={view.attempts} voice={voiceEnabled()} />
          {!view.lines.length ? (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">
              <DocumentText size={18} className="mt-0.5 shrink-0" />
              {app.externalCv ? "You sent a CV made elsewhere, so we can't link questions to its lines. Use the questions from real interviews to practise." : "We couldn't find the CV for this application, so we can't link questions to it."}
            </p>
          ) : null}
        </div>
        <aside className="space-y-3 self-start xl:col-start-2 xl:row-start-2">
          <WebQuestions applicationId={app.id} employer={app.employer} initial={view.webQuestions} />
          <Logistics applicationId={app.id} items={logisticsFor(view.invite.format)} done={view.invite.logisticsDone} />
        </aside>
      </div>
    </div>
  );
}
