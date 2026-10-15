"use client";

import { captureException } from "@sentry/browser";
import { useEffect } from "react";
import Link from "next/link";
import { Warning2 } from "@/components/icons";

/**
 * When one screen fails, the rest of the app stays: the menu and top bar remain, this
 * panel takes the page's place, and "Try again" reloads only that screen (D-150).
 * Reported to Sentry, scrubbed like every other error.
 */
export function ErrorPanel({ error, retry, home }: { error: Error & { digest?: string }; retry: () => void; home: string }) {
  useEffect(() => {
    captureException(error);
  }, [error]);
  return (
    <section role="alert" className="mx-auto mt-6 max-w-md rounded-[var(--radius-panel)] border border-ink-150 bg-white p-6 text-center shadow-card">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-care-50 text-care-600">
        <Warning2 size={28} variant="bulk" />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink-900">This Screen Didn&apos;t Load</h1>
      <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">Nothing you saved is lost. Try again; if it keeps happening, come back in a few minutes.</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={() => retry()} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          Try again
        </button>
        <Link href={home} className="inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-ink-700 hover:bg-ink-75">
          Go to the start
        </Link>
      </div>
      {error.digest ? <p className="mt-4 text-xs text-ink-400">Reference: {error.digest}</p> : null}
    </section>
  );
}
