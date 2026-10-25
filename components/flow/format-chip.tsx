"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TickCircle } from "@/components/icons";
import { chooseFormat } from "@/app/(app)/jobs/[id]/check/actions";
import { PROFILE_IDS, PROFILE_LABELS, type ProfileId } from "@/lib/rules/destination";
import { toast } from "@/components/ui/toaster";

/** What each format means, in a line (D-198, from each country's career guidance). */
const HINTS: Record<ProfileId, string> = {
  ng_graduate: "Education first, NYSC near the top, referees named. A4, up to 2 pages.",
  ng_private: "Experience first once you have it, NYSC shown, referees named. A4.",
  uk: "Profile at the top. No photo or date of birth. A4, up to 2 pages.",
  us: "A resume on Letter paper. No photo, age or references.",
  ca: "A resume on Letter paper, Canadian spelling. No photo, age or references.",
  gulf: "Profile at the top, every language listed. Date of birth only if the job asks.",
};

/**
 * Destination format chip: detected from the job, one tap to change, saved for this job.
 * `inline` opens the list in place (the CV page's side panel) instead of floating over the page.
 */
export function FormatChip({ jobId, initial, inline = false }: { jobId: string; initial: ProfileId; inline?: boolean }) {
  const router = useRouter();
  const [format, setFormat] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function pick(f: ProfileId) {
    setOpen(false);
    if (f === format) return;
    const before = format;
    setFormat(f);
    start(async () => {
      const res = await chooseFormat(jobId, f);
      if (!res.ok) {
        setFormat(before);
        toast(res.error ?? "We couldn't save that. Try again.", "error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={busy}
        className={`inline-flex min-h-12 items-center gap-2 rounded-2xl bg-ink-75 px-4 text-left text-sm text-ink-700 hover:bg-ink-100 disabled:opacity-60 ${inline ? "w-full justify-between" : ""}`}
      >
        <span>
          CV format: <span className="font-semibold text-ink-900">{PROFILE_LABELS[format]}</span>
        </span>
        <span className="font-semibold text-brand-700">Change</span>
      </button>
      {open ? (
        <ul role="listbox" aria-label="CV format" className={`mt-2 animate-pop rounded-2xl border border-ink-150 bg-white p-1.5 ${inline ? "w-full" : "absolute right-0 z-30 w-[min(88vw,22rem)] shadow-raised"}`}>
          {PROFILE_IDS.map((f) => (
            <li key={f} role="option" aria-selected={f === format}>
              <button
                type="button"
                onClick={() => pick(f)}
                className={`flex min-h-12 w-full items-start justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${f === format ? "bg-brand-50 text-brand-800" : "text-ink-800 hover:bg-ink-75"}`}
              >
                <span>
                  <span className="block font-semibold">{PROFILE_LABELS[f]}</span>
                  <span className="block text-xs leading-4 text-ink-500">{HINTS[f]}</span>
                </span>
                {f === format ? <TickCircle size={18} variant="bulk" className="mt-0.5 shrink-0" /> : null}
              </button>
            </li>
          ))}
          <li className="px-3 pb-2 pt-1 text-xs leading-5 text-ink-500">Detected from the job&apos;s location and how to apply. Your choice is kept for this job.</li>
        </ul>
      ) : null}
    </div>
  );
}
