import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getApplication } from "@/lib/applications/data";
import { getCvById } from "@/lib/cv/data";
import { hasDebrief } from "@/lib/applications/debrief";
import { nextStatuses } from "@/lib/rules/status-flow";
import { CHANNEL_LABELS } from "@/lib/jobs/labels";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { CopyField } from "@/components/ui/copy-button";
import { StatusUpdate } from "@/components/applications/status-update";
import { Timeline } from "@/components/applications/timeline";
import { LateReply } from "@/components/applications/late-reply";
import { ArrowLeft2, ArrowRight, Verify, DocumentDownload, DocumentText, Sms, Calendar, Location, Clipboard, MessageQuestion, Teacher, Send2, ShieldTick } from "@/components/icons";

export const metadata: Metadata = { title: "Application" };

const INVITED = new Set(["assessment", "interview", "second_interview"]);

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const app = await getApplication(viewer, id);
  if (!app) notFound();
  const [cv, debriefed] = await Promise.all([app.cvId ? getCvById(viewer, app.cvId) : null, hasDebrief(viewer, app.id)]);
  const job = app.snapshot?.parsed ?? null;
  const notSent = app.status === "draft" || app.status === "packed";
  const hadInterview = app.timeline.some((e) => e.to === "interview" || e.to === "second_interview");
  const place = job ? [job.location.city, job.location.state, job.location.country].filter(Boolean).join(", ") : "";
  const bulletCount = cv ? cv.doc.sections.reduce((n, s) => n + (s.kind === "roles" ? s.roles.reduce((m, r) => m + r.bullets.length, 0) : 0), 0) : 0;

  return (
    <div className="space-y-3">
      <Link href="/applications" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
        <ArrowLeft2 size={16} />
        Applications
      </Link>

      <header className="animate-rise">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={app.status} />
          {app.statusVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-proof-50 px-2.5 py-1 text-[0.8125rem] font-semibold text-proof-700">
              <Verify size={15} variant="bulk" />
              Confirmed from their message
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">{app.title}</h1>
        <p className="mt-1 text-[0.9375rem] text-ink-600">
          {app.employer}
          {app.sentAt ? ` · Sent ${formatDate(app.sentAt)}` : " · Not sent yet"}
          {app.pack ? ` · ${CHANNEL_LABELS[app.pack.channel]}` : ""}
        </p>
      </header>

      {notSent ? (
        <Banner tone="brand" icon={<Send2 size={24} variant="bulk" />} title="You haven't sent this one yet" body="Your CV and everything the employer asked for are ready. Send it from your phone, then tell us." href={`/jobs/${app.jobId}/pack`} cta="Finish and send" />
      ) : app.status === "no_response" ? (
        <LateReply applicationId={app.id} days={daysSince(app.sentAt)} />
      ) : INVITED.has(app.status) ? (
        <Banner tone="proof" icon={<Teacher size={24} variant="bulk" />} title="You're invited. Let's get you ready." body="Likely questions from this job and the CV you sent, practice answers with feedback, and a checklist for the day." href={`/applications/${app.id}/shortlist`} cta="Prepare for the interview" />
      ) : hadInterview && !debriefed ? (
        <Banner tone="ink" icon={<MessageQuestion size={24} variant="bulk" />} title="How did the interview go?" body="Two minutes, voice or text. Note the questions they asked while you still remember them." href={`/applications/${app.id}/debrief`} cta="Add interview notes" />
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          <section aria-labelledby="cv-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <DocumentText size={22} variant="bulk" />
                </span>
                <div>
                  <h2 id="cv-title" className="text-[0.9375rem] font-semibold text-ink-900">
                    {notSent ? "The CV you're sending" : "The CV you sent"}
                  </h2>
                  <p className="text-[0.8125rem] text-ink-500">{cv?.locked ? "Locked. Edits make a new version, so this stays exactly what they have." : "The version made for this job."}</p>
                </div>
              </div>
              {cv ? (
                <div className="flex gap-2">
                  <a href={`/api/cv/${cv.id}/export?type=pdf`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700">
                    <DocumentDownload size={18} />
                    PDF
                  </a>
                  <a href={`/api/cv/${cv.id}/export?type=docx`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink-200 px-3.5 text-sm font-semibold text-ink-800 hover:bg-ink-50">
                    Word
                  </a>
                </div>
              ) : null}
            </div>
            {!cv && app.externalCv ? (
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="min-w-0 text-sm text-ink-700">
                  <span className="block font-semibold text-ink-900 [overflow-wrap:anywhere]">{app.externalCv.name}</span>
                  The CV you made elsewhere and sent with this application.
                </p>
                <a href={`/api/applications/${app.id}/cv`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700">
                  <DocumentDownload size={18} />
                  Open it
                </a>
              </div>
            ) : cv ? (
              <div className="torn-edge mx-5 my-5 rounded-t-2xl bg-paper p-5 shadow-card">
                <p className="font-display text-lg font-semibold text-ink-900">{cv.doc.name}</p>
                <p className="text-[0.8125rem] text-ink-500">{cv.doc.titleLine}</p>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-ink-700">{cv.doc.summary.text}</p>
                <p className="mt-3 text-xs font-medium text-ink-500">
                  {bulletCount} lines of proof, every one from your vault · {cv.doc.fileBase}.pdf
                </p>
              </div>
            ) : (
              <p className="p-5 text-sm text-ink-600">No CV file saved with this application.</p>
            )}
          </section>

          {app.pack && app.pack.channel === "email" && app.pack.subject ? (
            <details className="group rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="grid size-11 place-items-center rounded-2xl bg-ink-75 text-ink-700">
                  <Sms size={22} variant="bulk" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-ink-900">The email</span>
                  <span className="block truncate text-[0.8125rem] text-ink-500">{app.pack.subject}</span>
                </span>
                <ArrowRight size={18} className="text-ink-400 transition-transform group-open:rotate-90" />
              </summary>
              <div className="space-y-3 border-t border-ink-100 p-5">
                <p className="text-sm">
                  <span className="text-ink-500">To </span>
                  <span className="font-medium text-ink-900">{app.pack.toEmail ?? "Not stated"}</span>
                </p>
                <CopyField value={app.pack.body} label="message" />
              </div>
            </details>
          ) : null}

          <section aria-labelledby="post-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
            <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-ink-75 text-ink-700">
                <Clipboard size={22} variant="bulk" />
              </span>
              <div>
                <h2 id="post-title" className="text-[0.9375rem] font-semibold text-ink-900">
                  The job post, as you saw it
                </h2>
                <p className="text-[0.8125rem] text-ink-500">
                  {app.snapshot ? `Saved ${formatDate(app.snapshot.capturedAt)}. Kept even if the advert is taken down.` : "Saved when you send it."}
                </p>
              </div>
            </div>
            {job ? (
              <div className="space-y-4 p-5">
                <dl className="grid gap-3 sm:grid-cols-2">
                  {place ? <Fact icon={<Location size={18} />} label="Location" value={place} /> : null}
                  {job.deadline ? <Fact icon={<Calendar size={18} />} label="Closing date" value={formatDate(`${job.deadline}T12:00:00+01:00`)} /> : null}
                </dl>
                {job.requirements.length ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">What they asked for</h3>
                    <ul className="mt-2 space-y-1.5">
                      {job.requirements.map((r) => (
                        <li key={r.text} className="flex gap-2 text-sm leading-6 text-ink-800">
                          <span aria-hidden="true" className={`mt-2.5 size-1.5 shrink-0 rounded-full ${r.importance === "must" ? "bg-brand-500" : "bg-ink-300"}`} />
                          <span>
                            {r.text}
                            {r.importance === "nice" ? <span className="text-ink-500"> (nice to have)</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {app.snapshot?.rawText ? (
                  <details className="rounded-2xl bg-ink-50">
                    <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-700">Read the full post</summary>
                    <p className="whitespace-pre-line px-4 pb-4 text-[0.8125rem] leading-6 text-ink-700">{app.snapshot.rawText}</p>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className="p-5 text-sm text-ink-600">The post is saved the moment you tap &ldquo;I&apos;ve sent it&rdquo;.</p>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          {!notSent ? <StatusUpdate applicationId={app.id} next={nextStatuses(app.status)} /> : null}
          <Timeline events={app.timeline} />
          <p className="flex items-start gap-2 px-1 text-xs leading-5 text-ink-500">
            <ShieldTick size={16} className="mt-px shrink-0" />
            Only you can see this application. It opens without data once you&apos;ve viewed it on this phone.
          </p>
        </aside>
      </div>
    </div>
  );
}

function daysSince(iso: string | null): number | null {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-ink-50 px-3.5 py-3">
      <span className="mt-0.5 text-ink-500">{icon}</span>
      <div>
        <dt className="text-xs text-ink-500">{label}</dt>
        <dd className="text-sm font-medium text-ink-900">{value}</dd>
      </div>
    </div>
  );
}

function Banner({ tone, icon, title, body, href, cta }: { tone: "brand" | "proof" | "ink"; icon: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  const tones = {
    brand: "brand-gradient text-white",
    proof: "bg-gradient-to-br from-proof-600 to-proof-800 text-white",
    ink: "bg-white text-ink-900 border border-ink-150",
  } as const;
  const sub = tone === "ink" ? "text-ink-600" : "text-white/85";
  return (
    <section className={`relative animate-rise overflow-hidden rounded-[var(--radius-panel)] p-5 shadow-raised lg:flex lg:items-center lg:justify-between lg:gap-6 lg:p-6 ${tones[tone]}`}>
      <div className="flex items-start gap-3.5">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tone === "ink" ? "bg-brand-50 text-brand-700" : "bg-white/15 text-white"}`}>{icon}</span>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className={`mt-1 max-w-xl text-sm leading-6 ${sub}`}>{body}</p>
        </div>
      </div>
      <Link
        href={href}
        className={`cta-sheen mt-4 inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-5 font-semibold lg:mt-0 lg:w-auto ${tone === "ink" ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-white text-ink-900 hover:bg-ink-50"}`}
      >
        {cta}
        <ArrowRight size={18} />
      </Link>
    </section>
  );
}
