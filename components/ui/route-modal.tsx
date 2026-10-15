"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ModalHeader } from "./modal-header";

/**
 * A screen shown over the current page (an intercepted route). Uses the native dialog
 * element, so focus is trapped and Escape closes it. Closing goes back, which restores
 * the page underneath and its URL. On phones it rises as a bottom sheet.
 */
// The loading frame opens first; the real screen then takes its place without a second pop.
let frameShownFor: string | null = null;

export function RouteModal({ title, description, children, href, frame = false }: { title: string; description?: string; children: ReactNode; href: string; frame?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  // Next keeps a parallel slot's last screen on other pages, so the modal shows only
  // while the address is its own (href). Comparing with the address it opened on was
  // not enough: a re-mounted slot took the new page's address and popped up again.
  const path = usePathname();
  const active = path === href;
  // Read once on mount: true when the loading frame for this screen was just on show.
  const [settled] = useState(() => !frame && frameShownFor === path);

  useEffect(() => {
    if (!active) return;
    frameShownFor = frame ? path : null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [active, frame, path]);

  if (!active) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-desc" : undefined}
      onCancel={(e) => {
        // A file picker's "cancel" bubbles up to here: only Escape on the dialog itself closes it.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        router.back();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) router.back();
      }}
      data-settled={settled || undefined}
      className="route-modal m-0 mt-auto max-h-[96dvh] min-h-[80dvh] w-full max-w-none overflow-hidden rounded-t-[var(--radius-panel)] bg-white p-0 text-ink-900 shadow-raised backdrop:bg-ink-950/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:min-h-0 sm:w-[calc(100%-3rem)] sm:max-w-4xl sm:rounded-[var(--radius-panel)]"
    >
      <div className="flex max-h-[96dvh] min-h-[inherit] flex-col sm:min-h-0">
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink-200 sm:hidden" />
        <ModalHeader id="modal-title" title={title} description={description ? <p id="modal-desc">{description}</p> : undefined} onClose={() => router.back()} size="lg" />
        <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">{children}</div>
      </div>
    </dialog>
  );
}

/**
 * Shown the instant a modal link is tapped (the route's loading.tsx), so the screen opens
 * straight away and fills in when the server is done.
 */
export function ModalLoading({ title, description, href }: { title: string; description?: string; href: string }) {
  return (
    <RouteModal title={title} description={description} href={href} frame>
      <div role="status" className="animate-pulse space-y-4">
        <span className="sr-only">Loading</span>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-32 rounded bg-ink-100" />
              <div className="h-12 rounded-2xl bg-ink-75" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-3.5 w-40 rounded bg-ink-100" />
          <div className="h-28 rounded-2xl bg-ink-75" />
        </div>
        <div className="h-12 w-40 rounded-2xl bg-ink-100" />
      </div>
    </RouteModal>
  );
}
