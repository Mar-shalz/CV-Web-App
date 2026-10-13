"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Add } from "@/components/icons";

/**
 * A screen shown over the current page (an intercepted route). Uses the native dialog
 * element, so focus is trapped and Escape closes it. Closing goes back, which restores
 * the page underneath and its URL. On phones it rises as a bottom sheet.
 */
export function RouteModal({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  // Next keeps a parallel slot's last screen on other pages, so the modal hides itself
  // as soon as the address moves on (for example after "Check this job"). A catch all
  // slot route would do this too, but it breaks every route outside the (app) group.
  const path = usePathname();
  const [openedOn] = useState(path);
  const active = path === openedOn;

  useEffect(() => {
    if (!active) return;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [active]);

  if (!active) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-desc" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        router.back();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) router.back();
      }}
      className="route-modal m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[var(--radius-panel)] bg-white p-0 text-ink-900 shadow-raised backdrop:bg-ink-950/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:w-[calc(100%-3rem)] sm:max-w-4xl sm:rounded-[var(--radius-panel)]"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="border-b border-ink-100 px-5 pb-4 pt-3 sm:px-7 sm:pt-4">
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink-200 sm:hidden" />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="grid size-10 place-items-center rounded-lg border border-ink-150 bg-white text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
              aria-label="Close"
            >
              <Add size={22} className="rotate-45" />
            </button>
          </div>
          <h2 id="modal-title" className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-[1.5rem]">
            {title}
          </h2>
          {description ? (
            <p id="modal-desc" className="mt-1 text-[0.875rem] leading-5 text-ink-600 sm:text-[0.9375rem] sm:leading-6">
              {description}
            </p>
          ) : null}
        </header>
        <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">{children}</div>
      </div>
    </dialog>
  );
}
