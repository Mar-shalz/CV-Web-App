"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateCv } from "@/app/(app)/jobs/[id]/cv/actions";
import { buttonClass } from "@/components/ui/button";
import { Crown1, Danger, Magicpen } from "@/components/icons";

const STEPS = ["Picking your strongest proof for this job", "Writing it in the employer's words", "Checking every line against your experience", "Laying out your CV"];

/** Starts the tailoring when the CV screen opens, with honest progress. */
export function GenerateCv({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ reason: string; error: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 5000);
    generateCv(jobId)
      .then((res) => {
        if (res.ok) router.refresh();
        else setResult({ reason: res.reason, error: res.error });
      })
      .catch(() => setResult({ reason: "error", error: "You seem to be offline. Try again when you're connected." }))
      .finally(() => clearInterval(timer));
    return () => clearInterval(timer);
  }, [jobId, router]);

  if (result?.reason === "paywall") {
    return (
      <section className="animate-pop rounded-[var(--radius-panel)] border border-brand-100 bg-gradient-to-b from-brand-50 to-white p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-600 text-white shadow-raised">
          <Crown1 size={32} variant="bulk" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-ink-900">Your free trial has ended</h2>
        <p className="mx-auto mt-1 max-w-md text-[0.9375rem] text-ink-600">Your experience, applications and scam checks stay free. The pass adds tailored CVs, emails and interview prep.</p>
        <Link href="/pass?from=tailor" className={buttonClass("primary", "lg", "mt-6")}>
          See the pass
        </Link>
      </section>
    );
  }
  if (result) {
    return (
      <section className="rounded-[var(--radius-card)] border border-flag-100 bg-flag-50 p-6" role="alert">
        <p className="flex items-start gap-2 font-semibold text-flag-700">
          <Danger size={22} variant="bulk" className="shrink-0" />
          {result.error}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.reason === "no_items" ? (
            <Link href="/vault/review" className={buttonClass("primary", "md")}>
              Check my experience
            </Link>
          ) : (
            <button type="button" onClick={() => location.reload()} className={buttonClass("primary", "md")}>
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-[var(--radius-panel)] border border-brand-100 bg-gradient-to-b from-brand-50 to-white p-8 text-center" role="status" aria-live="polite">
      <div className="relative mx-auto h-40 w-32 overflow-hidden rounded-xl border border-paper-edge bg-paper shadow-raised" aria-hidden="true">
        <span className="mx-auto mt-4 block h-2.5 w-16 rounded-full bg-ink-300" />
        <span className="mx-auto mt-1.5 block h-1.5 w-20 rounded-full bg-ink-150" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} className="mx-3 mt-2.5 block h-1.5 rounded-full bg-brand-200 animate-[pulse_1.6s_ease-in-out_infinite]" style={{ width: `${55 + ((i * 13) % 35)}%`, animationDelay: `${i * 0.15}s` }} />
        ))}
        <span className="absolute inset-x-0 top-0 h-10 animate-[scan_1.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-brand-400/30 to-transparent" />
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-lg font-semibold text-ink-900">
        <Magicpen size={22} variant="bulk" className="text-brand-600" />
        {STEPS[step]}
      </p>
      <p className="mt-1 text-sm text-ink-600">This takes about 20 seconds. Only things you confirmed go on it.</p>
    </section>
  );
}
