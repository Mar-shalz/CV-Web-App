"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SENT_VIA, SENT_VIA_LABELS, type SentVia } from "@/lib/applications/sent-via";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";
import { InfoCircle } from "@/components/icons";

/**
 * "How did you send it?" (D-199, D-201): one question before an application is marked as
 * sent, from the CV page or the board. `initial` is preselected when we already know.
 */
export function SentHowDialog({
  open,
  initial,
  title = "How did you send it?",
  note,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initial: SentVia | null;
  title?: string;
  note?: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (via: SentVia) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [via, setVia] = useState<SentVia | null>(initial);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setVia(initial);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, initial]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className="m-auto w-[min(92vw,480px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
      <ModalHeader id={titleId} title={title} description="We keep the CV with the application, exactly as it is now, and check in with you about it later." onClose={onClose} />
      <fieldset className="mt-1 space-y-2 px-5 pt-1 sm:px-7">
        <legend className="sr-only">How you sent it</legend>
        {SENT_VIA.map((v) => (
          <label key={v} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2 ring-1 transition-colors ${via === v ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-ink-150 hover:bg-ink-75"}`}>
            <input type="radio" name={`${titleId}-via`} value={v} checked={via === v} onChange={() => setVia(v)} className="size-4 accent-brand-600" />
            <span>
              <span className="block text-sm font-semibold text-ink-900">{SENT_VIA_LABELS[v].label}</span>
              {SENT_VIA_LABELS[v].hint ? <span className="block text-xs text-ink-500">{SENT_VIA_LABELS[v].hint}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      {note ? (
        <p className="mx-5 mt-3 flex gap-2 rounded-2xl bg-care-50 p-3 text-[0.8125rem] leading-5 text-care-700 sm:mx-7">
          <InfoCircle size={18} className="mt-px shrink-0" />
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mx-5 mt-3 text-sm text-flag-700 sm:mx-7">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 px-5 pb-6 pt-4 sm:grid-cols-2 sm:px-7">
        <Button variant="secondary" onClick={onClose}>
          Not yet
        </Button>
        <Button onClick={() => via && onConfirm(via)} disabled={busy || !via}>
          {busy ? "Saving..." : "Yes, I've sent it"}
        </Button>
      </div>
    </dialog>
  );
}
