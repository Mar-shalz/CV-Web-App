import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { accessOf } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import { PRICES } from "@/lib/config";
import { formatDate, formatNaira } from "@/lib/format";
import { track } from "@/lib/analytics/server";
import { PayButton } from "@/components/pass/pay-button";
import { passCvUsage } from "@/lib/payments/pass-usage";
import { ButtonLink } from "@/components/ui/button";
import { Crown1, TickCircle, ShieldTick, Card, Bank, Mobile, Teacher, Receipt21, Magicpen } from "@/components/icons";

export const metadata: Metadata = { title: "Job Hunt Pass" };

const adds = (cvs: number) => [
  `Up to ${cvs} tailored CVs, one for each job you apply to`,
  "The exact email, subject line and documents each employer asks for",
  "Interview prep for every invite: likely questions and practice with feedback",
];
const FREE = ["Your saved experience", "Checking if you qualify, and scam checks, on any job", "A record of every application, with the job post and the CV you sent"];

type Search = { product?: string; application?: string; reason?: string };

export default async function PassPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireReadyViewer();
  const { product, application, reason } = await searchParams;
  // The amounts in force (D-196), on the config's labels.
  const pass = { ...PRICES.products.job_hunt_30d, amount_kobo: viewer.pricing.pass.amountKobo, days: viewer.pricing.pass.days, tailored_cvs: viewer.pricing.pass.cvs };
  const boost = { ...PRICES.products.interview_boost, amount_kobo: viewer.pricing.boost.amountKobo };
  const state = accessOf(viewer);
  // While the app is open there is nothing to buy (D-196).
  if (state.kind === "open") redirect("/home");
  const ADDS = adds(pass.tailored_cvs);
  const appId = application && /^[0-9a-f-]{36}$/.test(application) ? application : null;
  const wantsBoost = product === "interview_boost" && Boolean(appId || viewer.preview);

  let history: { reference: string; type: string; amount: number; status: string; at: string; ends: string | null }[] = [];
  if (!viewer.preview) {
    const supabase = await createClient();
    const { data } = await supabase.from("passes").select("paystack_reference, type, amount_kobo, status, created_at, ends_at").eq("user_id", viewer.id).neq("type", "trial_3d").order("created_at", { ascending: false }).limit(10);
    history = (data ?? []).map((p) => ({ reference: p.paystack_reference ?? "", type: p.type, amount: p.amount_kobo, status: p.status, at: p.created_at, ends: p.ends_at }));
  }
  if (state.kind !== "pass") await track("paywall_shown", { trigger: reason ?? (wantsBoost ? "shortlist" : state.kind) }, viewer.id);
  const usage = state.kind === "pass" ? await passCvUsage(viewer) : null;
  const topup = { ...PRICES.products.cv_topup, amount_kobo: viewer.pricing.topup.amountKobo, adds_cvs: viewer.pricing.topup.cvs };

  const headline =
    state.kind === "pass"
      ? state.passType === "free_access"
        ? "You have free access"
        : "Your pass is on"
      : reason === "cv_cap" || (state.kind === "trial_ended" && state.reason === "cv_cap")
        ? `You've used your ${viewer.pricing.trial.cvs} free tailored CVs`
        : state.kind === "trial_ended"
          ? "Your free trial has ended"
          : "Keep your job hunt moving";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="animate-rise text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-brand-50 text-brand-700">
          <Crown1 size={28} variant="bulk" />
        </span>
        <h1 className="mt-4 font-display text-[1.875rem] font-semibold leading-10 tracking-[-0.03em] text-ink-900 lg:text-[2.5rem] lg:leading-[3rem]">{headline}</h1>
        <p className="mx-auto mt-2 max-w-xl text-[0.9375rem] leading-6 text-ink-600">
          {state.kind === "pass"
            ? state.passType === "free_access"
              ? "Everything is open for you, with nothing to pay."
              : `${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} left.${usage ? ` ${usage.left} of ${usage.cap} tailored CVs left.` : ""}`
            : `One payment, ${pass.days} days, no auto renewal. Everything you've built stays yours either way.`}
        </p>
      </header>

      {state.kind === "pass" ? (
        <div className="mx-auto max-w-xl space-y-3">
          {usage ? (
            <section aria-labelledby="usage-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="usage-title" className="text-[0.9375rem] font-semibold text-ink-900">
                  Tailored CVs in This Pass
                </h2>
                <p className="text-sm tabular-nums text-ink-600">
                  <span className="font-semibold text-ink-900">{usage.left}</span> of {usage.cap} left
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-150" role="progressbar" aria-valuemin={0} aria-valuemax={usage.cap} aria-valuenow={usage.used} aria-label="Tailored CVs used">
                <div className={`h-full rounded-full ${usage.left <= 3 ? "bg-care-600" : "bg-brand-600"}`} style={{ width: `${Math.min(100, (usage.used / usage.cap) * 100)}%` }} />
              </div>
              <p id="topup" className="mt-3 text-[0.8125rem] leading-5 text-ink-600">
                Running low? Add {topup.adds_cvs} more CVs for {formatNaira(topup.amount_kobo)}. They last until this pass ends.
              </p>
              <div className="mt-3">
                <PayButton product="cv_topup" label={`Add ${topup.adds_cvs} CVs for ${formatNaira(topup.amount_kobo)}`} variant={usage.left <= 3 ? "primary" : "secondary"} />
              </div>
            </section>
          ) : null}
          <div className="flex justify-center">
            <ButtonLink href="/jobs/new" size="lg">
              <Magicpen size={20} variant="bulk" />
              Tailor my CV
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div className={`grid gap-3 ${wantsBoost ? "lg:grid-cols-2" : "mx-auto max-w-xl"}`}>
          <section aria-labelledby="pass-title" className="relative flex flex-col overflow-hidden rounded-[var(--radius-panel)] border-2 border-brand-500 bg-white p-6 shadow-raised">
            <span className="absolute right-5 top-5 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Best value</span>
            <h2 id="pass-title" className="text-sm font-semibold text-brand-700">
              {pass.label}
            </h2>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.03em] text-ink-900">{formatNaira(pass.amount_kobo)}</span>
              <span className="text-[0.9375rem] text-ink-500">for {pass.days} days</span>
            </p>
            <ul className="mt-5 space-y-3 text-[0.9375rem] text-ink-800">
              {ADDS.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <TickCircle size={20} variant="bulk" className="shrink-0 text-brand-600" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <PayButton product="job_hunt_30d" label={`Pay ${formatNaira(pass.amount_kobo)}`} />
            </div>
          </section>

          {wantsBoost ? (
            <section aria-labelledby="boost-title" className="flex flex-col rounded-[var(--radius-panel)] border border-ink-150 bg-white p-6 shadow-card">
              <h2 id="boost-title" className="flex items-center gap-2 text-sm font-semibold text-proof-700">
                <Teacher size={18} variant="bulk" />
                {boost.label}
              </h2>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.03em] text-ink-900">{formatNaira(boost.amount_kobo)}</span>
                <span className="text-[0.9375rem] text-ink-500">once</span>
              </p>
              <p className="mt-5 flex-1 text-[0.9375rem] leading-6 text-ink-700">Shortlist mode for this one invite: likely questions from the CV you sent, practice with feedback, and a checklist for the day.</p>
              <div className="mt-6">
                <PayButton product="interview_boost" application={appId} label={`Pay ${formatNaira(boost.amount_kobo)}`} variant="secondary" />
              </div>
            </section>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="free-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 id="free-title" className="text-[0.9375rem] font-semibold text-ink-900">
            Free Forever, Pass or No Pass
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            {FREE.map((t) => (
              <li key={t} className="flex gap-2">
                <TickCircle size={18} className="shrink-0 text-proof-600" />
                {t}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="how-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 id="how-title" className="text-[0.9375rem] font-semibold text-ink-900">
            How Paying Works
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[
              { icon: <Card size={16} />, label: "Card" },
              { icon: <Bank size={16} />, label: "Bank transfer" },
              { icon: <Mobile size={16} />, label: "USSD" },
            ].map((m) => (
              <li key={m.label} className="inline-flex items-center gap-1.5 rounded-full bg-ink-75 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700">
                {m.icon}
                {m.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-6 text-ink-700">
            You pay on Paystack&apos;s secure page. We never see your card details. Transfers and USSD can take a few minutes to confirm.
          </p>
          <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-ink-700">
            <ShieldTick size={18} className="mt-1 shrink-0 text-brand-600" />
            Changed your mind? We refund within {PRICES.refund_rule.within_days} days if you packed fewer than {PRICES.refund_rule.max_packed_applications + 1} applications.
          </p>
        </section>
      </div>

      {history.length ? (
        <section aria-labelledby="receipts-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
          <h2 id="receipts-title" className="flex items-center gap-2 px-5 pt-5 text-[0.9375rem] font-semibold text-ink-900">
            <Receipt21 size={20} variant="bulk" />
            Your payments
          </h2>
          <ul className="mt-2 divide-y divide-ink-100">
            {history.map((h) => (
              <li key={h.reference} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="text-ink-800">
                  {h.type === "interview_boost" ? boost.label : pass.label} · {formatNaira(h.amount)}
                </span>
                <span className="text-ink-500">
                  {formatDate(h.at)} · {h.status === "active" ? (h.ends ? `Until ${formatDate(h.ends)}` : "Active") : h.status[0]?.toUpperCase() + h.status.slice(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
