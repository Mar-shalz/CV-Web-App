import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { TickCircle, ShieldTick, Verify } from "@/components/icons";
import { APP, APP_NAME } from "@/lib/config";

const STEPS = [
  { n: 1, label: "Create your account" },
  { n: 2, label: "Review your privacy choices" },
  { n: 3, label: "Set up your job search" },
] as const;

/**
 * Access layout from the founder's reference: a full white screen, a rounded
 * gradient panel on the left with the three setup steps, and the form on the right.
 * Phone (360px): the panel shrinks to a short band above the form.
 */
export function AuthShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-white p-3 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center lg:gap-6 lg:px-6 lg:py-6">
      {/* Brand panel */}
      {/* Nearly full height, centred, with a strip of white above and below. */}
      <aside className="aurora flex flex-col rounded-[24px] px-5 pb-6 pt-5 text-white lg:h-[min(1120px,calc(100dvh-3rem))] lg:min-h-[600px] lg:rounded-[28px] lg:p-10 xl:p-14">
        <div className="aurora-floor" aria-hidden="true" />
        <Link href="/" className="inline-flex rounded-xl" aria-label={`${APP_NAME} home`}>
          <Logo tone="onDark" />
        </Link>

        <FloatingProof />

        <div className="mt-5 lg:mt-auto">
          <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.8125rem] font-medium">
            <span className="lg:hidden">
              Step {step} of 3 · {STEPS[step - 1].label}
            </span>
            <span className="hidden lg:inline">For anyone looking for their next job</span>
          </p>
          <h1 className="mt-3 font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.03em] lg:mt-6 lg:text-[3.5rem] xl:text-[4rem]">
            {APP.tagline}
          </h1>
          <p className="mt-2 max-w-xl text-[0.9375rem] leading-6 text-white/85 lg:mt-4 lg:text-lg lg:leading-7">
            Three quick steps to set up your account.
          </p>
        </div>

        <ol className="stagger mt-10 hidden w-full grid-cols-3 gap-3 lg:grid xl:gap-4" aria-label="Account setup steps">
          {STEPS.map((s, i) => {
            const state = s.n < step ? "done" : s.n === step ? "current" : "next";
            return (
              <li
                key={s.n}
                style={{ "--i": i } as CSSProperties}
                aria-current={state === "current" ? "step" : undefined}
                className={`flex min-h-[150px] flex-col justify-between rounded-[20px] p-5 transition-colors ${
                  state === "current" ? "bg-white text-ink-900 shadow-[0_24px_48px_-24px_rgb(11_24_56/0.6)]" : "glass text-white"
                }`}
              >
                <span
                  className={`grid size-9 place-items-center rounded-full text-sm font-semibold ${
                    state === "current" ? "bg-brand-600 text-white" : state === "done" ? "bg-white text-brand-700" : "border border-white/60"
                  }`}
                >
                  {state === "done" ? <TickCircle size={20} variant="bulk" /> : s.n}
                  <span className="sr-only">{state === "done" ? ", done" : state === "current" ? ", current step" : ", coming up"}</span>
                </span>
                <span className={`text-[0.9375rem] font-medium leading-5 ${state === "current" ? "" : "text-white/90"}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Form */}
      <main id="main" className="flex flex-col px-2 pb-10 pt-8 lg:justify-center lg:px-10 lg:py-12 xl:px-16">
        <div className="mx-auto w-full max-w-[440px] animate-rise">
          <header className="text-center">
            <h2 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink-900 lg:text-[2.5rem] lg:leading-[1.1]">{title}</h2>
            {subtitle ? <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">{subtitle}</p> : null}
          </header>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Two small proof cards drifting on the panel: what the product checks for you. */
function FloatingProof() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative hidden h-0 w-full lg:block">
      <div className="glass absolute right-0 top-10 flex animate-float items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium xl:right-6">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-proof-600">
          <ShieldTick size={20} variant="bulk" />
        </span>
        Found on the official careers page
      </div>
      <div
        className="glass absolute left-0 top-36 flex animate-float items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium xl:left-6"
        style={{ animationDelay: "-3.5s" }}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-white text-brand-600">
          <Verify size={20} variant="bulk" />
        </span>
        Every CV line traced to you
      </div>
    </div>
  );
}
