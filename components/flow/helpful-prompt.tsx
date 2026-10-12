"use client";

import { useState } from "react";
import { answerSurvey } from "@/app/(app)/jobs/[id]/check/actions";
import { Like1, TickCircle } from "@/components/icons";

/** One tap research survey under every verdict (PRD research plan: "Was this helpful?"). */
export function HelpfulPrompt({ jobId }: { jobId: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  function pick(a: "yes" | "no") {
    setAnswer(a);
    void answerSurvey({ survey: "verdict_helpful", answer: a, job_id: jobId });
  }
  return (
    <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card" aria-live="polite">
      {answer ? (
        <p className="flex animate-pop items-center gap-2 text-sm font-medium text-proof-700">
          <TickCircle size={20} variant="bulk" />
          Thanks. {answer === "yes" ? "Glad it helped." : "We'll use this to improve our checks."}
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-900">Was this check helpful?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => pick("yes")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink-75 text-sm font-semibold text-ink-700 hover:bg-ink-100">
              <Like1 size={18} />
              Yes
            </button>
            <button type="button" onClick={() => pick("no")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink-75 text-sm font-semibold text-ink-700 hover:bg-ink-100">
              <Like1 size={18} className="rotate-180" />
              Not really
            </button>
          </div>
        </>
      )}
    </section>
  );
}
