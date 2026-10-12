import type { Metadata } from "next";
import { requireDemoJob } from "@/lib/demo/guard";
import { DEMO_ELIGIBILITY, DEMO_JOB, DEMO_SCAM, DEMO_VERDICT, type ReqStatus } from "@/lib/demo/job";
import { formatDate } from "@/lib/format";
import { FlowSteps } from "@/components/flow/flow-steps";
import { ScamCheck } from "@/components/flow/scam-check";
import { FormatChip } from "@/components/flow/format-chip";
import { HelpfulPrompt } from "@/components/flow/helpful-prompt";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { Building, Location, Calendar1, Sms, Global, Magicpen, ArrowRight, TickCircle, Warning2, MinusCircle, Archive, Lamp } from "@/components/icons";

export const metadata: Metadata = { title: "Job check" };

const VERDICT = {
  apply: { label: "Apply", tone: "from-proof-50 border-proof-100", icon: TickCircle, iconTone: "bg-proof-600" },
  apply_with_care: { label: "Apply with care", tone: "from-care-50 border-care-100", icon: Warning2, iconTone: "bg-care-600" },
  skip: { label: "Skip this one", tone: "from-ink-100 border-ink-200", icon: MinusCircle, iconTone: "bg-ink-600" },
} as const;

const REQ = {
  met: { label: "Met", tone: "proof" as const },
  partly: { label: "Partly met", tone: "care" as const },
  missing: { label: "Missing", tone: "neutral" as const },
} satisfies Record<ReqStatus, { label: string; tone: "proof" | "care" | "neutral" }>;

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export default async function JobCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireDemoJob(id);
  const v = VERDICT[DEMO_VERDICT.verdict];
  const VIcon = v.icon;
  const left = daysUntil(DEMO_JOB.deadline);
  const met = DEMO_VERDICT.requirements.filter((r) => r.status === "met").length;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <FlowSteps current="check" hrefs={{ add: "/jobs/new" }} />

      {/* Job summary */}
      <section className="animate-rise rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink-500">{DEMO_JOB.capturedVia}</p>
            <h1 className="mt-1 font-display text-[1.5rem] font-semibold leading-8 tracking-[-0.02em] text-ink-900 lg:text-[1.875rem] lg:leading-10">{DEMO_JOB.title}</h1>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
              <li className="flex items-center gap-1.5">
                <Building size={18} />
                {DEMO_JOB.employer}
              </li>
              <li className="flex items-center gap-1.5">
                <Location size={18} />
                {DEMO_JOB.location}
              </li>
              <li className="flex items-center gap-1.5">
                <Calendar1 size={18} />
                Closes {formatDate(DEMO_JOB.deadline)}
                <span className="font-semibold text-care-700">· {left} days left</span>
              </li>
              <li className="flex items-center gap-1.5">
                {DEMO_JOB.apply.channel === "email" ? <Sms size={18} /> : <Global size={18} />}
                Apply by email
              </li>
            </ul>
          </div>
          <FormatChip initial={DEMO_JOB.destination.format} />
        </div>
      </section>

      {/* Verdict */}
      <section
        aria-labelledby="verdict-title"
        className={`animate-pop rounded-[var(--radius-panel)] border bg-gradient-to-br to-white p-5 lg:p-7 ${v.tone}`}
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className={`grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-raised ${v.iconTone}`}>
              <VIcon size={30} variant="bulk" />
            </span>
            <div>
              <p className="text-sm font-medium text-ink-600">Our advice</p>
              <h2 id="verdict-title" className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-ink-900">
                {v.label}
              </h2>
              <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-700">{DEMO_VERDICT.line}</p>
              <p className="mt-2 text-xs text-ink-500">This is advice, not a decision. You can always apply anyway.</p>
            </div>
          </div>
          <div className="hidden shrink-0 gap-3 lg:flex">
            <ButtonLink href="/applications?status=not_sent" variant="secondary">
              <Archive size={20} />
              Save for later
            </ButtonLink>
            <ButtonLink href="/jobs/demo/cv" size="lg" className="cta-sheen">
              <Magicpen size={20} variant="bulk" />
              Tailor my CV
              <ArrowRight size={18} />
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {/* Hard requirements */}
          <section aria-labelledby="hard-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="hard-title" className="text-lg font-semibold text-ink-900">
                Must-have requirements
              </h2>
              <Badge tone="proof">All met</Badge>
            </div>
            <p className="mt-1 text-[0.8125rem] text-ink-500">Checked by fixed rules against your details. The job post&apos;s exact words are quoted.</p>
            <ul className="stagger mt-4 divide-y divide-ink-100">
              {DEMO_ELIGIBILITY.map((r, i) => (
                <li key={r.rule} style={{ ["--i" as string]: i }} className="grid gap-2 py-3.5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <span className="text-sm font-semibold text-ink-900">{r.rule}</span>
                  <span className="text-[0.8125rem] leading-5 text-ink-600">
                    <span className="italic">&ldquo;{r.quote}&rdquo;</span>
                    <span className="block text-ink-500">You: {r.yours}</span>
                  </span>
                  <Badge tone={r.result === "pass" ? "proof" : r.result === "fail" ? "neutral" : "care"}>
                    {r.result === "pass" ? "Met" : r.result === "fail" ? "Not met" : "Need a detail"}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>

          {/* Match */}
          <section aria-labelledby="match-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="match-title" className="text-lg font-semibold text-ink-900">
                How your experience matches
              </h2>
              <span className="text-sm text-ink-500">
                {met} of {DEMO_VERDICT.requirements.length} met
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {DEMO_VERDICT.requirements.map((r) => (
                <li key={r.text} className="rounded-2xl bg-ink-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[0.9375rem] font-medium text-ink-900">{r.text}</p>
                    <Badge tone={REQ[r.status].tone}>{REQ[r.status].label}</Badge>
                  </div>
                  <p className="mt-1.5 text-[0.8125rem] leading-5 text-ink-600">
                    {r.from ? (
                      <>
                        From your experience: <span className="text-ink-800">{r.from}</span>
                      </>
                    ) : (
                      "Nothing in your experience covers this yet. That's fine: it's a nice to have."
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <ScamCheck state={DEMO_SCAM.state} headline={DEMO_SCAM.headline} signals={DEMO_SCAM.signals} />

          <section aria-labelledby="gap-title" className="rounded-[var(--radius-card)] border border-care-100 bg-care-50/60 p-5">
            <h2 id="gap-title" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-care-700">
              <Lamp size={20} variant="bulk" />
              One thing to prepare
            </h2>
            {DEMO_VERDICT.gaps.map((g) => (
              <div key={g.gap} className="mt-2 text-[0.8125rem] leading-5 text-care-700">
                <p className="font-semibold">{g.gap}</p>
                <p className="mt-1">{g.fix}</p>
              </div>
            ))}
          </section>

          <HelpfulPrompt />
        </div>
      </div>

      {/* Phone action bar, above the bottom nav */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-ink-150 bg-white/95 p-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <ButtonLink href="/applications?status=not_sent" variant="secondary" className="shrink-0" aria-label="Save for later">
            <Archive size={20} />
          </ButtonLink>
          <ButtonLink href="/jobs/demo/cv" className="flex-1">
            <Magicpen size={20} variant="bulk" />
            Tailor my CV
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
