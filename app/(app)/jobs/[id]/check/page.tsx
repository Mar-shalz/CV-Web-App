import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireReadyViewer, type Viewer } from "@/lib/auth/viewer";
import { getJob, type JobView } from "@/lib/jobs/data";
import { getVault, type Vault } from "@/lib/vault/data";
import { getVerdict, runEligibility } from "@/lib/jobs/check";
import { quickCheck } from "@/lib/legitimacy";
import { startTrialIfNeeded } from "@/lib/entitlements-server";
import { accessState, canUse } from "@/lib/entitlements";
import type { FinalVerdict } from "@/lib/rules/verdict";
import type { EligibilityResult } from "@/lib/rules/eligibility/types";
import { FILTER_LABELS, CHANNEL_LABELS } from "@/lib/jobs/labels";
import { PROFILE_LABELS } from "@/lib/rules/destination";
import { formatDate } from "@/lib/format";
import { setJobState } from "./actions";
import { FlowSteps } from "@/components/flow/flow-steps";
import { ScamCheck } from "@/components/flow/scam-check";
import { FormatChip } from "@/components/flow/format-chip";
import { HelpfulPrompt } from "@/components/flow/helpful-prompt";
import { MissingDetailCard } from "@/components/flow/missing-detail";
import { Badge } from "@/components/ui/status";
import { buttonClass } from "@/components/ui/button";
import { Building, Location, Calendar1, Sms, Global, Magicpen, ArrowRight, TickCircle, Warning2, MinusCircle, Archive, Lamp, Crown1 } from "@/components/icons";
import { PendingButton } from "@/components/ui/pending-button";
import { WorkingNotice } from "@/components/ui/working-notice";

export const metadata: Metadata = { title: "Job Check" };

const VERDICT = {
  apply: { label: "Apply", tone: "from-proof-50 border-proof-100", icon: TickCircle, iconTone: "bg-proof-600" },
  apply_with_care: { label: "Apply with care", tone: "from-care-50 border-care-100", icon: Warning2, iconTone: "bg-care-600" },
  skip: { label: "Skip this one", tone: "from-ink-100 border-ink-200", icon: MinusCircle, iconTone: "bg-ink-600" },
} as const;

const REQ = { met: { label: "Met", tone: "proof" }, partly: { label: "Partly met", tone: "care" }, missing: { label: "Missing", tone: "neutral" } } as const;
const RULE = { pass: { label: "Met", tone: "proof" }, fail: { label: "Not met", tone: "neutral" }, unknown: { label: "Need a detail", tone: "brand" }, care: { label: "Check this", tone: "care" }, not_applicable: { label: "Doesn't apply", tone: "neutral" } } as const;

const daysUntil = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59+01:00`).getTime() - Date.now()) / 86_400_000);

export default async function JobCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const job = await getJob(viewer, id);
  await startTrialIfNeeded(viewer);
  const vault = await getVault(viewer);
  const eligibility = await runEligibility(viewer, job, vault);
  const verdictPromise = getVerdict(viewer, job, vault, eligibility);
  const quick = quickCheck(job.rawText ?? "", job.parsed);
  const p = job.parsed;
  const left = p.deadline ? daysUntil(p.deadline) : null;

  return (
    <div className="space-y-3 pb-24 lg:pb-0">
      <FlowSteps current="check" hrefs={{ add: `/jobs/${job.id}` }} back={`/jobs/${job.id}`} />

      <section className="animate-rise rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[1.5rem] font-semibold leading-8 tracking-[-0.02em] text-ink-900 lg:text-[1.875rem] lg:leading-10">{p.title ?? "Untitled job"}</h1>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
              <li className="flex items-center gap-1.5">
                <Building size={18} />
                {p.employer_name ?? (p.employer_is_agency_client ? "Employer not named" : "Employer not stated")}
              </li>
              {p.location.city || p.location.state || p.location.country ? (
                <li className="flex items-center gap-1.5">
                  <Location size={18} />
                  {[p.location.city, p.location.state, p.location.remote ? "Remote" : null].filter(Boolean).join(", ") || p.location.country}
                </li>
              ) : null}
              {p.deadline ? (
                <li className="flex items-center gap-1.5">
                  <Calendar1 size={18} />
                  Closes {formatDate(p.deadline)}
                  {left !== null && left >= 0 ? <span className={`font-semibold ${left <= 3 ? "text-flag-700" : "text-care-700"}`}>· {left === 0 ? "today" : `${left} ${left === 1 ? "day" : "days"} left`}</span> : null}
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                {p.how_to_apply.channel === "email" ? <Sms size={18} /> : <Global size={18} />}
                {CHANNEL_LABELS[p.how_to_apply.channel]}
              </li>
            </ul>
          </div>
          <FormatChip initial={PROFILE_LABELS[job.destination.profile]} />
        </div>
        {job.destination.fallbackNote ? <p className="mt-3 text-xs text-ink-500">{job.destination.fallbackNote}</p> : null}
      </section>

      <Suspense fallback={<VerdictSkeleton />}>
        <VerdictHero promise={verdictPromise} viewer={viewer} job={job} />
      </Suspense>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <EligibilityCard eligibility={eligibility} job={job} />
          <Suspense fallback={<div className="skeleton h-64 rounded-[var(--radius-card)]" />}>
            <MatchList promise={verdictPromise} vault={vault} />
          </Suspense>
        </div>
        <div className="space-y-3">
          <ScamCheck jobId={job.id} initial={quick} />
          <Suspense fallback={null}>
            <Gaps promise={verdictPromise} />
          </Suspense>
          <HelpfulPrompt jobId={job.id} />
        </div>
      </div>
    </div>
  );
}

function VerdictSkeleton() {
  return (
    <WorkingNotice
      title="Checking Your CV Against This Job"
      steps={["Reading what the job asks for", "Matching it with your experience", "Checking the rules for this kind of job", "Writing our advice"]}
      estimate="Usually 10 to 40 seconds"
      stepSeconds={7}
    />
  );
}

async function VerdictHero({ promise, viewer, job }: { promise: Promise<FinalVerdict>; viewer: Viewer; job: JobView }) {
  const v = await promise;
  const t = VERDICT[v.verdict];
  const Icon = t.icon;
  const access = accessState({ trialStartedAt: viewer.trial.startedAt, trialEndsAt: viewer.trial.endsAt, trialCvsUsed: viewer.trial.cvsUsed, activePass: viewer.activePass });
  const canTailor = canUse("tailored_cv", access);

  const tailor = canTailor ? (
    <form action={setJobState}>
      <input type="hidden" name="job_id" value={job.id} />
      <input type="hidden" name="state" value="applying" />
      <PendingButton pendingLabel="Opening" className={buttonClass("primary", "lg", "cta-sheen w-full sm:w-auto")}>
        <Magicpen size={20} variant="bulk" />
        Tailor my CV
        <ArrowRight size={18} />
      </PendingButton>
    </form>
  ) : (
    <Link href="/pass?from=tailor" className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
      <Crown1 size={20} variant="bulk" />
      Get the pass to tailor your CV
    </Link>
  );
  const save = (
    <form action={setJobState}>
      <input type="hidden" name="job_id" value={job.id} />
      <input type="hidden" name="state" value="saved" />
      <PendingButton pendingLabel="Saving" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
        <Archive size={20} />
        Save for later
      </PendingButton>
    </form>
  );

  return (
    <section aria-labelledby="verdict-title" className={`animate-pop rounded-[var(--radius-panel)] border bg-gradient-to-br to-white p-5 lg:p-7 ${t.tone}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className={`grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-raised ${t.iconTone}`}>
            <Icon size={30} variant="bulk" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-600">Our advice</p>
            <h2 id="verdict-title" className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-ink-900">
              {t.label}
            </h2>
            <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-700">{v.line}</p>
            <p className="mt-2 text-xs text-ink-500">This is advice, not a decision. You can always apply anyway.</p>
          </div>
        </div>
        {v.verdict !== "skip" ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {save}
            {tailor}
          </div>
        ) : (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {canTailor ? (
              <form action={setJobState}>
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="state" value="applying" />
                <input type="hidden" name="override" value="1" />
                <PendingButton pendingLabel="Opening" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
                  <Magicpen size={20} />
                  Build my closest CV anyway
                </PendingButton>
              </form>
            ) : (
              <Link href="/pass?from=tailor" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
                Get the pass to tailor your CV
              </Link>
            )}
            <Link href="/jobs/new" className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
              Check another job
              <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </div>
      {v.verdict === "skip" ? (
        <p className="mt-4 rounded-2xl bg-white/70 p-4 text-[0.8125rem] leading-5 text-ink-700">
          Still want to apply? Your call. We&apos;ll build the closest honest CV from what you&apos;ve told us, and we won&apos;t hide the gap.
        </p>
      ) : null}
    </section>
  );
}

function EligibilityCard({ eligibility, job }: { eligibility: EligibilityResult; job: JobView }) {
  const outcomes = eligibility.outcomes;
  const allMet = outcomes.length > 0 && outcomes.every((o) => o.result === "pass");
  const unknowns = outcomes.filter((o) => o.result === "unknown" && o.needs);
  const rtw = job.parsed.hard_filters.find((f) => f.type === "right_to_work");
  return (
    <section aria-labelledby="hard-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hard-title" className="text-lg font-semibold text-ink-900">
          Must-have Requirements
        </h2>
        {allMet ? <Badge tone="proof">All met</Badge> : null}
      </div>
      <p className="mt-1 text-[0.8125rem] text-ink-500">Checked by fixed rules against your details, not by AI. The job post&apos;s exact words are quoted.</p>
      {outcomes.length ? (
        <ul className="stagger mt-4 divide-y divide-ink-100">
          {outcomes.map((o, i) => (
            <li key={`${o.type}-${i}`} style={{ ["--i" as string]: i }} className="grid gap-2 py-3.5 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
              <span className="text-sm font-semibold text-ink-900">{o.type === "deadline" ? "Closing date" : FILTER_LABELS[o.type]}</span>
              <span className="text-[0.8125rem] leading-5 text-ink-600">
                <span className="italic">&ldquo;{o.quote}&rdquo;</span>
                <span className="mt-0.5 block text-ink-700">{o.reason}</span>
              </span>
              <Badge tone={RULE[o.result].tone}>{RULE[o.result].label}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">This post doesn&apos;t state hard requirements like age, class of degree or NYSC. Check the full post to be sure.</p>
      )}
      {unknowns.length ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-ink-900">{unknowns.length === 1 ? "One question to finish the check" : `${unknowns.length} questions to finish the check`}</p>
          {unknowns.map((u) => (
            <MissingDetailCard key={u.type} jobId={job.id} need={u.needs!} quote={u.quote} country={u.type === "right_to_work" ? rtw?.values[0] : undefined} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

async function MatchList({ promise, vault }: { promise: Promise<FinalVerdict>; vault: Vault }) {
  const v = await promise;
  const items = new Map(vault.roles.flatMap((r) => r.items.map((i) => [i.id, { text: i.text, role: r.title }] as const)));
  const met = v.requirements.filter((r) => r.status === "met").length;
  if (!v.requirements.length) return null;
  return (
    <section aria-labelledby="match-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="match-title" className="text-lg font-semibold text-ink-900">
          How Your Experience Matches
        </h2>
        <span className="text-sm text-ink-500">
          {met} of {v.requirements.length} met
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {v.requirements.map((r, i) => (
          <li key={i} className="rounded-2xl bg-ink-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-[0.9375rem] font-medium text-ink-900">{r.text}</p>
              <Badge tone={REQ[r.status].tone}>{REQ[r.status].label}</Badge>
            </div>
            {r.vaultItemIds.length ? (
              <ul className="mt-2 space-y-1">
                {r.vaultItemIds.map((id) =>
                  items.get(id) ? (
                    <li key={id} className="text-[0.8125rem] leading-5 text-ink-600">
                      From your experience: <span className="text-ink-800">{items.get(id)!.text}</span>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : (
              <p className="mt-1.5 text-[0.8125rem] text-ink-600">Nothing in your experience covers this yet.</p>
            )}
            {r.note ? <p className="mt-1 text-xs text-care-700">{r.note}</p> : null}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[0.8125rem] text-ink-500">
        Missing something you&apos;ve actually done?{" "}
        <Link href="/experience/interview" className="font-semibold text-brand-700 hover:underline">
          Add it to your experience
        </Link>{" "}
        and check again.
      </p>
    </section>
  );
}

async function Gaps({ promise }: { promise: Promise<FinalVerdict> }) {
  const v = await promise;
  if (!v.gaps.length) return null;
  const where = { cv: "On your CV", email: "In your email", interview: "In the interview" } as const;
  return (
    <section aria-labelledby="gap-title" className="rounded-[var(--radius-card)] border border-care-100 bg-care-50/60 p-5">
      <h2 id="gap-title" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-care-700">
        <Lamp size={20} variant="bulk" />
        {v.gaps.length === 1 ? "One thing to prepare" : "Things to prepare"}
      </h2>
      <ul className="mt-2 space-y-3">
        {v.gaps.map((g) => (
          <li key={g.gap} className="text-[0.8125rem] leading-5 text-care-700">
            <p className="font-semibold">{g.gap}</p>
            <p className="mt-0.5">
              <span className="font-medium">{where[g.addressIn]}:</span> {g.how}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
