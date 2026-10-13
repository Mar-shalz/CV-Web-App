import Link from "next/link";
import { ArrowRight, DocumentUpload, Magicpen, TickCircle, Warning2, ShieldTick } from "@/components/icons";

const STEPS = ["Add the job description", "See if you qualify", "Get your tailored CV and email"];

/**
 * The main action on Home, in the user's own words: "tailor my CV to this job".
 * The whole drop area is one big link to the capture screen.
 */
export function TailorHero({ trialReady }: { trialReady: boolean }) {
  return (
    <section aria-labelledby="tailor-title" className="aurora aurora-soft relative overflow-hidden rounded-[var(--radius-panel)] p-5 text-white sm:p-6 lg:p-7">
      <div className="aurora-floor" aria-hidden="true" />
      <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium">
            <Magicpen size={16} variant="bulk" />
            {trialReady ? "Your free trial starts here" : "Tailor a CV in about 4 minutes"}
          </p>
          <h2 id="tailor-title" className="mt-4 max-w-xl font-display text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] lg:text-[2.5rem]">
            Found a job you like? Let&apos;s tailor your CV to it.
          </h2>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-6 text-white/85 lg:text-base lg:leading-7">
            Add the job description. We check you qualify and that the job looks genuine, then rewrite your CV to match, using only things you
            actually did.
          </p>

          <Link
            href="/jobs/new"
            className="group mt-6 flex items-center gap-4 rounded-2xl border-2 border-dashed border-white/45 bg-white/10 p-4 transition-all duration-300 hover:border-white hover:bg-white/15 sm:p-5"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-raised transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-4deg]">
              <DocumentUpload size={28} variant="bulk" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold lg:text-lg">Paste or upload a job description</span>
              <span className="mt-0.5 block text-[0.8125rem] leading-5 text-white/80">Text, PDF, Word, a link, or a screenshot of a flyer</span>
            </span>
            <span className="hidden min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-5 text-[0.9375rem] font-semibold text-brand-800 transition-colors group-hover:bg-brand-50 sm:inline-flex">
              Tailor my CV
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Link>

          <ol className="mt-5 flex flex-col gap-2 text-[0.8125rem] text-white/90 sm:flex-row sm:flex-wrap sm:gap-x-6" aria-label="How it works">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-white/20 text-xs font-semibold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        {/* A sample result, drawn in HTML: shows what you get before you start */}
        <div aria-hidden="true" data-decorative="" className="relative hidden xl:block">
          <div className="absolute -inset-3 rotate-[-4deg] rounded-[26px] bg-white/10" />
          <div className="relative animate-float rounded-[22px] bg-white p-4 text-ink-900 shadow-[0_30px_60px_-30px_rgb(11_24_56/0.8)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-ink-500">Graduate Trainee</p>
                <p className="text-[0.9375rem] font-semibold">Northbridge Bank</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-proof-50 px-2.5 py-1 text-xs font-semibold text-proof-700">
                <TickCircle size={14} variant="bulk" />
                Apply
              </span>
            </div>
            <ul className="mt-3 space-y-2 border-t border-ink-100 pt-3 text-[0.8125rem]">
              <li className="flex items-center gap-2">
                <TickCircle size={16} variant="bulk" className="text-proof-600" />
                Second Class Upper
              </li>
              <li className="flex items-center gap-2">
                <TickCircle size={16} variant="bulk" className="text-proof-600" />
                NYSC completed
              </li>
              <li className="flex items-center gap-2">
                <Warning2 size={16} variant="bulk" className="text-care-600" />
                Excel modelling: partly
              </li>
            </ul>
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-ink-75 px-2.5 py-2 text-xs font-medium text-ink-700">
              <ShieldTick size={16} variant="bulk" className="text-proof-600" />
              Found on the official careers page
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
