import Link from "next/link";
import type { AccessState } from "@/lib/entitlements";
import { formatNaira } from "@/lib/format";
import { PRICES } from "@/lib/config";
import { Crown1, Timer1 } from "@/components/icons";

function describe(state: AccessState) {
  const price = formatNaira(PRICES.products.job_hunt_30d.amount_kobo);
  const days = PRICES.products.job_hunt_30d.days;
  switch (state.kind) {
    case "pass":
      if (state.passType === "free_access")
        return { title: "Free access", line: state.daysLeft > 3650 ? "No end date" : `${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} left`, body: "Everything is open for you.", cta: null, meter: null };
      return { title: "Job hunt pass", line: `${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} left`, body: "Unlimited tailored CVs, emails and interview prep.", cta: null, meter: null };
    case "trial":
      return {
        title: "Free trial",
        line: `${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} left`,
        body: `${state.cvsLeft} tailored ${state.cvsLeft === 1 ? "CV" : "CVs"} left.`,
        cta: { href: "/pass", label: `Get the pass · ${price}` },
        meter: { used: state.cvsUsed, total: state.cvCap, label: `${state.cvsUsed} of ${state.cvCap} trial CVs used` },
      };
    case "trial_ready":
      return { title: "Free trial ready", line: `${state.trialDays} days · ${state.cvCap} CVs`, body: "It starts when you add your first job. No card needed.", cta: null, meter: null };
    case "trial_ended":
      return {
        title: state.reason === "cv_cap" ? "Trial CVs used up" : "Your trial has ended",
        line: "Free tools still on",
        body: `Get ${days} days of tailored CVs and interview prep for ${price}.`,
        cta: { href: "/pass", label: `Get ${days} days · ${price}` },
        meter: null,
      };
  }
}

/** Trial or pass status with days left (sidebar and Home on phones). */
export function AccessCard({ state }: { state: AccessState }) {
  const d = describe(state);
  return (
    <section aria-label="Your plan" className="brand-gradient relative overflow-hidden rounded-[20px] p-4 text-white">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" aria-hidden="true" />
      <div className="relative flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-white/15">
          {state.kind === "pass" ? <Crown1 size={20} variant="bulk" /> : <Timer1 size={20} variant="bulk" />}
        </span>
        <div>
          <h2 className="text-[0.9375rem] font-semibold leading-5">{d.title}</h2>
          <p className="text-xs text-white/80">{d.line}</p>
        </div>
      </div>
      <p className="relative mt-3 text-[0.8125rem] leading-5 text-white/90">{d.body}</p>
      {d.meter ? (
        <div className="relative mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/25" role="meter" aria-valuemin={0} aria-valuemax={d.meter.total} aria-valuenow={d.meter.used} aria-label={d.meter.label}>
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${(d.meter.used / d.meter.total) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-white/80">{d.meter.label}</p>
        </div>
      ) : null}
      {d.cta ? (
        <Link href={d.cta.href} className="relative mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50">
          {d.cta.label}
        </Link>
      ) : null}
    </section>
  );
}

export function AccessBadge({ state }: { state: AccessState }) {
  const d = describe(state);
  return (
    <Link href="/pass" className="brand-gradient mx-auto grid size-12 place-items-center rounded-2xl text-white" title={`${d.title}: ${d.line}`}>
      {state.kind === "pass" ? <Crown1 size={22} variant="bulk" /> : <Timer1 size={22} variant="bulk" />}
      <span className="sr-only">
        {d.title}: {d.line}
      </span>
    </Link>
  );
}
