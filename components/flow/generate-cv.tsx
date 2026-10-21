"use client";

import { useEffect, useRef, useState } from "react";
import { WorkingNotice } from "@/components/ui/working-notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateCv } from "@/app/(app)/jobs/[id]/cv/actions";
import { buttonClass } from "@/components/ui/button";
import { Crown1, Danger } from "@/components/icons";

const STEPS = ["Picking your strongest proof for this job", "Writing it in the employer's words", "Checking every line against your experience", "Laying out your CV"];

/** Starts the tailoring when the CV screen opens, with honest progress. */
export function GenerateCv({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<{ reason: string; error: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    generateCv(jobId)
      .then((res) => {
        if (res.ok) router.refresh();
        else setResult({ reason: res.reason, error: res.error });
      })
      .catch(() => setResult({ reason: "error", error: "You seem to be offline. Try again when you're connected." }));
  }, [jobId, router]);

  if (result?.reason === "paywall") {
    return (
      <section className="animate-pop rounded-[var(--radius-panel)] border border-brand-100 bg-gradient-to-b from-brand-50 to-white p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-600 text-white shadow-raised">
          <Crown1 size={32} variant="bulk" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-ink-900">Your Free Trial Has Ended</h2>
        <p className="mx-auto mt-1 max-w-md text-[0.9375rem] text-ink-600">Your experience, applications and scam checks stay free. The pass adds tailored CVs, emails and interview prep.</p>
        <Link href="/pass?from=tailor" className={buttonClass("primary", "lg", "mt-6")}>
          See the pass
        </Link>
      </section>
    );
  }
  if (result?.reason === "cv_cap") {
    return (
      <section className="animate-pop rounded-[var(--radius-panel)] border border-brand-100 bg-gradient-to-b from-brand-50 to-white p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-600 text-white shadow-raised">
          <Crown1 size={32} variant="bulk" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-ink-900">You&apos;ve Used Every CV in This Pass</h2>
        <p className="mx-auto mt-1 max-w-md text-[0.9375rem] text-ink-600">{result.error}</p>
        <Link href="/pass?product=cv_topup" className={buttonClass("primary", "lg", "mt-6")}>
          Add more CVs
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
            <Link href="/experience/review" className={buttonClass("primary", "md")}>
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
  return <WorkingNotice title="Writing your CV for This Job" steps={STEPS} estimate="Usually 1 to 2 minutes. We take the time to get every line right, and only things you confirmed go on it" stepSeconds={10} />;
}
