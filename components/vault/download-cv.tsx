"use client";

import { useCallback, useRef, useState } from "react";
import lazy from "next/dynamic";
import { ModalHeader } from "@/components/ui/modal-header";
import { DocumentDownload } from "@/components/icons";

// The panel (writing, downloads) loads on first open, which keeps My Experience inside the first load budget.
const CvPanel = lazy(() => import("./cv-panel").then((m) => m.CvPanel), {
  loading: () => (
    <div className="px-5 py-8 sm:px-7" role="status">
      <span className="sr-only">Loading</span>
      <div className="h-24 animate-pulse rounded-2xl bg-ink-75" />
    </div>
  ),
});

/**
 * "Download my CV" on My Experience (D-124): a strong general CV written from everything
 * confirmed, as PDF or Word. Made again only when the experience changes.
 */
export function DownloadCv({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(0);
  const [busy, setBusy] = useState(false);
  const onBusy = useCallback((b: boolean) => setBusy(b), []);
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          ref.current?.showModal();
          if (!busy) setOpened((n) => n + 1);
        }}
        // Outlined, so it never competes with "Tailor my CV", the main action (founder, round 14).
        className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-brand-600 bg-white px-5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 active:scale-[0.98]"
      >
        <DocumentDownload size={20} variant="bulk" />
        Download my CV
      </button>
      <dialog
        ref={ref}
        aria-labelledby="dl-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) close();
        }}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        className="route-modal m-0 mt-auto min-h-[70dvh] w-full max-w-none rounded-t-[var(--radius-panel)] bg-white p-0 text-ink-900 shadow-raised backdrop:bg-ink-950/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:min-h-0 sm:w-[calc(100%-3rem)] sm:max-w-lg sm:rounded-[var(--radius-panel)]"
      >
        <ModalHeader id="dl-title" title="Your CV" description={<p>A strong general CV from everything you&apos;ve confirmed. For a particular job, tailor one instead.</p>} onClose={close} />
        {opened ? <CvPanel key={opened} ready={ready} onBusy={onBusy} onClose={close} /> : null}
      </dialog>
    </>
  );
}
