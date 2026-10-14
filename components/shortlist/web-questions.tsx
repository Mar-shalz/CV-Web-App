"use client";

import { useState, useTransition } from "react";
import { searchWebQuestions } from "@/app/(app)/applications/[id]/shortlist/actions";
import type { WebQuestion } from "@/lib/shortlist/data";
import { Button } from "@/components/ui/button";
import { Global, SearchStatus, ExportSquare } from "@/components/icons";

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Questions people report from real interviews for this employer or role, with sources. */
export function WebQuestions({ applicationId, employer, initial }: { applicationId: string; employer: string; initial: WebQuestion[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function find() {
    setError(null);
    start(async () => {
      const res = await searchWebQuestions(applicationId);
      if (res.ok) setItems(res.questions);
      else setError(res.error);
    });
  }

  return (
    <section aria-labelledby="web-q-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Global size={20} variant="bulk" />
        </span>
        <div className="min-w-0">
          <h2 id="web-q-title" className="text-[0.9375rem] font-semibold text-ink-900">
            Asked in Real Interviews
          </h2>
          <p className="text-[0.8125rem] leading-5 text-ink-600">Questions people report from interviews at {employer} or for roles like this one, with where we found them.</p>
        </div>
      </div>

      {items.length ? (
        <ol className="stagger mt-4 space-y-3">
          {items.map((q, i) => (
            <li key={q.question} style={{ ["--i" as string]: i }} className="rounded-xl bg-ink-50 p-3.5">
              <p className="text-sm font-semibold text-ink-900">{q.question}</p>
              <p className="mt-1 text-xs text-ink-600">{q.why}</p>
              <a href={q.source.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                {host(q.source.url)}
                <ExportSquare size={12} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ol>
      ) : busy ? (
        <div aria-live="polite" className="mt-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <SearchStatus size={18} className="animate-pulse" />
            Searching the web for interview reports…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <Button variant="secondary" className="mt-4 w-full" onClick={find}>
          <SearchStatus size={18} />
          Find questions from real interviews
        </Button>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-care-700">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-[0.6875rem] leading-4 text-ink-500">From public pages on the web. Use them to practise; they aren&apos;t a promise of what you&apos;ll be asked.</p>
    </section>
  );
}
