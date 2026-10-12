"use client";

import { useEffect, useRef, useState } from "react";
import { TickCircle } from "@/components/icons";

const FORMATS = ["Nigerian graduate programme", "Nigerian private sector", "UK"];

/** Destination format chip: detected from the job, one tap to change, saved per job. */
export function FormatChip({ initial }: { initial: string }) {
  const [format, setFormat] = useState(initial);
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-ink-75 px-4 text-left text-sm text-ink-700 hover:bg-ink-100"
      >
        <span>
          CV format: <span className="font-semibold text-ink-900">{format}</span>
        </span>
        <span className="font-semibold text-brand-700">Change</span>
      </button>
      {open ? (
        <ul role="listbox" aria-label="CV format" className="absolute right-0 z-30 mt-2 w-72 animate-pop rounded-2xl border border-ink-150 bg-white p-1.5 shadow-raised">
          {FORMATS.map((f) => (
            <li key={f} role="option" aria-selected={f === format}>
              <button
                type="button"
                onClick={() => {
                  setFormat(f);
                  setOpen(false);
                }}
                className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm ${f === format ? "bg-brand-50 font-semibold text-brand-800" : "text-ink-800 hover:bg-ink-75"}`}
              >
                {f}
                {f === format ? <TickCircle size={18} variant="bulk" /> : null}
              </button>
            </li>
          ))}
          <li className="px-3 pb-2 pt-1 text-xs leading-5 text-ink-500">Detected from the job&apos;s location and how to apply. Your choice is kept for this job.</li>
        </ul>
      ) : null}
    </div>
  );
}
