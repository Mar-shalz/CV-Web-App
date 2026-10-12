import type { CSSProperties } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { PriceDoor, Waitlist } from "@/components/landing/waitlist";
import { ArrowRight, DocumentUpload, ShieldSearch, Magicpen, Send2, TickCircle, Warning2, MinusCircle, ShieldTick, CloseCircle, Verify } from "@/components/icons";
import { APP, APP_NAME, LIMITS, PRICES } from "@/lib/config";
import { formatNaira } from "@/lib/format";

const STEPS = [
  { icon: DocumentUpload, title: "Add the job description", body: "Paste it, upload it, share a link, or add a photo of a job flyer from WhatsApp." },
  { icon: ShieldSearch, title: "See if it's worth applying", body: "We check the must haves, like class of degree, NYSC and age, and look for signs of a scam." },
  { icon: Magicpen, title: "Get your tailored CV", body: "Rewritten to match the job, in the format the employer expects. Nothing made up." },
  { icon: Send2, title: "Send it yourself", body: "The exact subject line and email they asked for. You send it from your phone." },
];

const NEVERS = [
  "Add a number, employer, title or grade you didn't give us",
  "Tell you a job is safe when we can't prove it",
  "Send anything to an employer for you",
  "Suggest hiding your age, grade or NYSC status",
];

export default function LandingPage() {
  const pass = PRICES.products.job_hunt_30d;
  const price = formatNaira(pass.amount_kobo);

  return (
    <div className="min-h-dvh bg-white">
      <main id="main">
        {/* Hero: a rounded gradient panel on a white page, like the access screens */}
        <section className="p-3 lg:p-4">
          <div className="aurora rounded-[28px] px-5 pb-12 pt-5 text-white lg:px-12 lg:pb-20 lg:pt-8">
            <div className="aurora-floor" aria-hidden="true" />
            <header className="flex items-center justify-between">
              <Logo tone="onDark" />
              <nav aria-label="Site" className="flex items-center gap-1">
                <a href="#how" className="hidden min-h-12 items-center rounded-2xl px-4 text-[0.9375rem] font-medium text-white/90 hover:bg-white/10 sm:inline-flex">
                  How it works
                </a>
                <a href="#pricing" className="hidden min-h-12 items-center rounded-2xl px-4 text-[0.9375rem] font-medium text-white/90 hover:bg-white/10 sm:inline-flex">
                  Pricing
                </a>
                <Link href="/sign-in" className="glass inline-flex min-h-12 items-center rounded-2xl px-5 text-[0.9375rem] font-semibold hover:bg-white/25">
                  Sign in
                </Link>
              </nav>
            </header>

            <div className="mx-auto mt-12 grid max-w-[1200px] items-center gap-12 lg:mt-20 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="animate-rise">
                <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.8125rem] font-medium">
                  <Verify size={16} variant="bulk" />
                  Built for NYSC members and new graduates
                </p>
                <h1 className="mt-5 font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.04em] lg:text-[4.75rem]">{APP.tagline}</h1>
                <p className="mt-5 max-w-xl text-[1.0625rem] leading-7 text-white/90 lg:text-xl lg:leading-8">
                  Paste a job description. We tell you honestly if you qualify, flag scam signs, and tailor your CV to match, using only what you&apos;ve
                  actually done.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href="/sign-in" size="lg" variant="light" className="cta-sheen">
                    Tailor my CV for free
                    <ArrowRight size={20} />
                  </ButtonLink>
                  <a href="#how" className="glass inline-flex min-h-14 items-center justify-center rounded-2xl px-6 font-semibold hover:bg-white/25">
                    See how it works
                  </a>
                </div>
                <p className="mt-4 text-sm text-white/80">
                  {LIMITS.trial.days} day free trial · No card needed · Scam checks free forever
                </p>
              </div>

              {/* A real verdict, drawn in HTML: zero image bytes. The employer is fictional. */}
              <div aria-hidden="true" className="relative mx-auto w-full max-w-[440px]">
                <div className="absolute -inset-4 rotate-[-4deg] rounded-[30px] bg-white/10" />
                <div className="relative animate-float rounded-[24px] bg-white p-5 text-ink-900 shadow-[0_40px_80px_-40px_rgb(11_24_56/0.8)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.8125rem] text-ink-500">Graduate Trainee</p>
                      <p className="text-lg font-semibold">Northbridge Bank</p>
                    </div>
                    <Badge tone="care">Apply with care</Badge>
                  </div>
                  <ul className="mt-4 space-y-2.5 border-t border-ink-100 pt-4 text-sm">
                    <li className="flex items-center gap-2.5">
                      <TickCircle size={18} variant="bulk" className="text-proof-600" />
                      <span className="flex-1">Second Class Upper</span>
                      <span className="text-xs font-semibold text-proof-700">Met</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <TickCircle size={18} variant="bulk" className="text-proof-600" />
                      <span className="flex-1">NYSC completed</span>
                      <span className="text-xs font-semibold text-proof-700">Met</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Warning2 size={18} variant="bulk" className="text-care-600" />
                      <span className="flex-1">Excel modelling</span>
                      <span className="text-xs font-semibold text-care-700">Partly met</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <MinusCircle size={18} variant="bulk" className="text-ink-500" />
                      <span className="flex-1">ICAN in progress</span>
                      <span className="text-xs font-semibold text-ink-600">Missing</span>
                    </li>
                  </ul>
                  <p className="mt-4 rounded-2xl bg-care-50 p-3 text-[0.8125rem] leading-5 text-care-700">
                    You fit most of this, but they want Excel modelling. Mention your final year project in the email, and be ready to talk about it.
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-[0.8125rem] font-medium text-proof-700">
                    <ShieldTick size={18} variant="bulk" />
                    Found on the official careers page. Even so, never pay to apply.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-16 lg:px-8 lg:py-24">
          <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-brand-700">How it works</p>
          <h2 id="how-title" className="mt-2 max-w-2xl font-display text-[2rem] font-semibold leading-tight tracking-[-0.03em] lg:text-[3rem]">
            Fewer applications. More interviews.
          </h2>
          <ol className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} style={{ "--i": i } as CSSProperties} className="lift rounded-[var(--radius-card)] border border-ink-150 bg-ink-50/60 p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-[var(--shadow-cta)]">
                    <Icon size={24} variant="bulk" />
                  </span>
                  <span className="font-display text-sm font-semibold text-ink-400">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Promise */}
        <section aria-labelledby="never-title" className="px-3 lg:px-4">
          <div className="rounded-[28px] bg-brand-950 px-5 py-16 text-white lg:px-12 lg:py-24">
            <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-2">
              <div>
                <h2 id="never-title" className="font-display text-[2rem] font-semibold leading-tight tracking-[-0.03em] lg:text-[3rem]">
                  Every line, you can defend.
                </h2>
                <p className="mt-4 max-w-md text-[1.0625rem] leading-7 text-white/80">
                  Recruiters can spot a polished CV full of made up claims. We only reword what you actually did, and flag any line we can&apos;t trace
                  back to you before you download.
                </p>
              </div>
              <ul className="grid gap-3">
                {NEVERS.map((n) => (
                  <li key={n} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-[0.9375rem] font-medium">
                    <CloseCircle size={24} variant="bulk" className="shrink-0 text-sky-300" />
                    <span>
                      <span className="sr-only">We never </span>
                      {n}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" aria-labelledby="price-title" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-16 lg:px-8 lg:py-24">
          <h2 id="price-title" className="font-display text-[2rem] font-semibold leading-tight tracking-[-0.03em] lg:text-[3rem]">
            Pay for a job hunt, not a document.
          </h2>
          <p className="mt-3 max-w-xl text-[1.0625rem] leading-7 text-ink-600">Pay in naira by card, bank transfer or USSD. No auto renewal, ever.</p>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-ink-150 p-6 lg:p-8">
              <h3 className="text-xl font-semibold">Free forever</h3>
              <p className="mt-1 font-display text-[2.5rem] font-semibold tracking-[-0.03em]">₦0</p>
              <ul className="mt-5 space-y-3 text-[0.9375rem]">
                {["Your experience, stored safely", "Check if you qualify for any job", "Scam checks on any job", "A record of every application you send"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <TickCircle size={20} variant="bulk" className="text-proof-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-2xl bg-ink-50 p-3.5 text-sm leading-6 text-ink-600">
                Plus a {LIMITS.trial.days} day trial of everything, with up to {LIMITS.trial.tailored_cv_cap} tailored CVs. It starts when you add your first
                job, not when you sign up.
              </p>
            </div>
            <div className="relative rounded-[var(--radius-card)] border-2 border-brand-600 p-6 shadow-raised lg:p-8">
              <p className="absolute -top-3.5 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">For an active job hunt</p>
              <h3 className="text-xl font-semibold">{pass.label}</h3>
              <p className="mt-1 font-display text-[2.5rem] font-semibold tracking-[-0.03em]">
                {price} <span className="text-base font-medium text-ink-500">for {pass.days} days</span>
              </p>
              <ul className="mt-5 space-y-3 text-[0.9375rem]">
                {["Unlimited job checks", "Tailored CVs in Nigerian and UK formats", "Ready to send emails and form answers", "Interview prep from the CV you sent"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <TickCircle size={20} variant="bulk" className="text-brand-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <PriceDoor product="job_hunt_30d" label={`Start your ${LIMITS.trial.days} day trial, then ${price} for ${pass.days} days`} />
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist */}
        <section aria-labelledby="wl-title" className="px-3 pb-16 lg:px-4 lg:pb-24">
          <div className="mx-auto max-w-[1200px] rounded-[var(--radius-panel)] bg-brand-50 p-6 lg:p-12">
            <h2 id="wl-title" className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] lg:text-[2.25rem]">
              Join the waiting list
            </h2>
            <p className="mt-2 max-w-xl text-[0.9375rem] leading-6 text-ink-600">We&apos;re letting people in from job groups and campuses in small batches.</p>
            <div className="mt-5 max-w-xl">
              <Waitlist source="footer" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-150">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span className="flex items-center gap-3">
            <Logo size={30} />
            <span className="text-ink-500">© 2026 {APP_NAME}</span>
          </span>
          <nav aria-label="Legal" className="flex gap-2">
            <Link href="/legal/privacy" className="inline-flex min-h-12 items-center rounded-xl px-3 hover:bg-ink-50">
              Privacy
            </Link>
            <Link href="/legal/terms" className="inline-flex min-h-12 items-center rounded-xl px-3 hover:bg-ink-50">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
