"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Notification, Add, TickCircle, ArrowRight2 } from "@/components/icons";

/**
 * The bell in the top bar. Opens a panel from the right with the applications waiting
 * for an update, each answerable in one tap. A native dialog, so focus is trapped and
 * Escape closes it.
 */
export function UpdatesDrawer({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  // Open only on the page it was opened from, so answering "Invited" (which goes to
  // interview prep) closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean) => setOpenOn(v ? path : null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid size-12 place-items-center rounded-full bg-ink-75 text-ink-700 transition-colors hover:bg-ink-100"
        aria-label={count ? `${count} ${count === 1 ? "application needs" : "applications need"} an update` : "Updates: nothing waiting"}
        aria-haspopup="dialog"
      >
        <Notification size={22} />
        {count ? (
          <span className="absolute right-2.5 top-2.5 grid size-[18px] place-items-center rounded-full bg-flag-600 text-[0.6875rem] font-semibold text-white ring-2 ring-white" aria-hidden="true">
            {count}
          </span>
        ) : null}
      </button>

      <dialog
        ref={ref}
        aria-labelledby="updates-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="side-sheet m-0 ml-auto h-dvh max-h-none w-full max-w-[420px] bg-white p-0 text-ink-900 shadow-raised backdrop:bg-ink-950/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex h-full flex-col">
          <header className="border-b border-ink-100 px-5 pb-4 pt-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-10 place-items-center rounded-lg border border-ink-150 bg-white text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
                aria-label="Close updates"
              >
                <Add size={22} className="rotate-45" />
              </button>
            </div>
            <h2 id="updates-title" className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-ink-900">
              Updates
            </h2>
            <p className="mt-1 text-sm leading-5 text-ink-600">
              {count ? "Any news on these applications? Tap one answer for each." : "Nothing needs your answer right now."}
            </p>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {count ? (
              children
            ) : (
              <div className="grid place-items-center py-10 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-proof-50 text-proof-700">
                  <TickCircle size={28} variant="bulk" />
                </span>
                <p className="mt-3 font-semibold text-ink-900">You&apos;re all caught up</p>
                <p className="mt-1 max-w-[260px] text-sm leading-5 text-ink-600">We&apos;ll ask here when an application you sent in the last 30 days needs an update.</p>
              </div>
            )}
          </div>

          <footer className="border-t border-ink-100 p-4">
            <Link href="/applications" className="flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              See all applications
              <ArrowRight2 size={16} />
            </Link>
          </footer>
        </div>
      </dialog>
    </>
  );
}
