"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { makeGeneralCv } from "@/app/(app)/experience/actions";
import type { GeneralCvResult } from "@/lib/cv/general";
import { WorkingNotice } from "@/components/ui/working-notice";
import { DocumentDownload, ShieldTick, Magicpen, Warning2, Edit2 } from "@/components/icons";

const STEPS = ["Reading your confirmed experience", "Finding your field and the words recruiters search for", "Writing each line to a high standard", "Checking every line against what you confirmed"];

/** The inside of "Download my CV" (D-124), loaded the first time it opens to keep My Experience light. */
export function CvPanel({ ready, onBusy, onClose }: { ready: boolean; onBusy: (busy: boolean) => void; onClose: () => void }) {
  const [result, setResult] = useState<GeneralCvResult | null>(null);
  const [busy, start] = useTransition();
  const run = () =>
    start(async () => {
      setResult(null);
      try {
        setResult(await makeGeneralCv());
      } catch {
        setResult({ ok: false, error: "We couldn't write your CV just now. Try again." });
      }
    });
  useEffect(() => {
    if (ready) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => onBusy(busy), [busy, onBusy]);

  return (
    <div className="space-y-4 px-5 py-5 sm:px-7">
      {!ready ? (
        <p className="flex items-start gap-2 rounded-2xl bg-care-50 p-4 text-sm leading-6 text-care-700">
          <Warning2 size={20} variant="bulk" className="mt-0.5 shrink-0" />
          Confirm a few achievements first. Your CV is written only from what you&apos;ve confirmed.
        </p>
      ) : busy ? (
        <WorkingNotice compact title="Writing Your CV" steps={STEPS} estimate="Usually 1 to 2 minutes" stepSeconds={9} />
      ) : result?.ok ? (
        <>
          <div className="rounded-2xl bg-proof-50 p-4 text-sm leading-6 text-proof-700">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldTick size={20} variant="bulk" />
              Ready: written for {result.targetTitle} roles.
            </p>
            <p className="mt-1">
              {result.lines} lines, each from your confirmed experience{result.keywordsUsed ? `, using ${result.keywordsUsed} of the words recruiters in your field search for` : ""}.
            </p>
            {result.toCheck ? (
              <p className="mt-1 text-care-700">{result.toCheck === 1 ? "1 line has" : `${result.toCheck} lines have`} words we couldn&apos;t trace to what you confirmed. You&apos;ll see {result.toCheck === 1 ? "it" : "them"} marked, and can fix {result.toCheck === 1 ? "it" : "them"} before you download.</p>
            ) : null}
          </div>
          {/* Read it first, especially when a line needs a look (founder, round 16). */}
          <Link href={`/experience/cv/${result.cvId}`} onClick={onClose} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
            <Edit2 size={20} />
            {result.toCheck ? `Review ${result.toCheck === 1 ? "1 line" : `${result.toCheck} lines`} and download` : "Read it, choose a design, download"}
          </Link>
          {!result.toCheck ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={`/api/cv/${result.cvId}/export?type=pdf`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-ink-200 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50">
                <DocumentDownload size={20} />
                Quick PDF
              </a>
              <a href={`/api/cv/${result.cvId}/export?type=docx`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-ink-200 px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50">
                Quick Word file
              </a>
            </div>
          ) : null}
          <p className="text-xs leading-5 text-ink-500">Written fresh each time you open this. Add or confirm more achievements for a stronger CV.</p>
        </>
      ) : result && !result.ok ? (
        <div className="space-y-3">
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-flag-50 p-4 text-sm leading-6 text-flag-700">
            <Warning2 size={20} variant="bulk" className="mt-0.5 shrink-0" />
            {result.error}
          </p>
          <button type="button" onClick={run} className="inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
            Try again
          </button>
        </div>
      ) : null}
      <Link href="/jobs/new" onClick={onClose} className="flex items-center gap-2 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-700 hover:bg-ink-75">
        <Magicpen size={20} variant="bulk" className="shrink-0 text-brand-600" />
        <span>
          <span className="font-semibold text-ink-900">Applying for a particular job?</span> A CV tailored to it gets more interviews.
        </span>
      </Link>
    </div>
  );
}
