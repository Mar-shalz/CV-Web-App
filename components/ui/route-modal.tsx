"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CloseCircle } from "@/components/icons";

/**
 * A screen shown over the current page (an intercepted route). Uses the native dialog
 * element, so focus is trapped and Escape closes it. Closing goes back, which restores
 * the page underneath and its URL. On phones it rises as a bottom sheet.
 */
export function RouteModal({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

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
      className="route-modal m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[var(--radius-panel)] bg-white p-0 text-ink-900 shadow-raised backdrop:bg-ink-950/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-2xl sm:rounded-[var(--radius-panel)]"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 pb-4 pt-5 sm:px-6">
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink-200 sm:hidden" />
          <div className="min-w-0">
            <h2 id="modal-title" className="font-display text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-[1.375rem]">
              {title}
            </h2>
            {description ? (
              <p id="modal-desc" className="mt-1 text-[0.875rem] leading-5 text-ink-600">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={() => router.back()} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-75 hover:text-ink-900" aria-label="Close">
            <CloseCircle size={24} />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
      </div>
    </dialog>
  );
}
