"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { InboxItem, InboxKind } from "@/lib/notifications/data";
import { markUpdatesRead } from "@/lib/notifications/actions";
import { ModalHeader } from "@/components/ui/modal-header";
import { Notification, Messages2, Card, Crown1, Clock, Send2, InfoCircle, ArrowRight2 } from "@/components/icons";

const KIND: Record<InboxKind, { icon: typeof Notification; tint: string; label: string }> = {
  announcement: { icon: Messages2, tint: "bg-brand-50 text-brand-700", label: "From the team" },
  message: { icon: Messages2, tint: "bg-brand-50 text-brand-700", label: "Message for you" },
  payment: { icon: Card, tint: "bg-proof-50 text-proof-700", label: "Payment" },
  pass: { icon: Crown1, tint: "bg-care-50 text-care-700", label: "Your pass" },
  trial: { icon: Clock, tint: "bg-care-50 text-care-700", label: "Your trial" },
  application: { icon: Send2, tint: "bg-ink-75 text-ink-700", label: "Application" },
  system: { icon: InfoCircle, tint: "bg-ink-75 text-ink-700", label: "Update" },
};

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * The bell in the top bar opens Updates from the right: applications waiting for your
 * answer, then messages from the team, payment receipts and reminders about your pass
 * or trial. Opening it marks everything as seen.
 */
export function UpdatesDrawer({ checkInCount, checkIns, items }: { checkInCount: number; checkIns: ReactNode; items: InboxItem[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const path = usePathname();
  // Open only on the page it was opened from, so a link inside closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const unread = items.filter((i) => i.unread).length;
  const badge = checkInCount + unread;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function show() {
    setOpenOn(path);
    const ids = items.filter((i) => i.unread).map((i) => i.id);
    if (ids.length) void markUpdatesRead(ids);
  }

  function hide() {
    setOpenOn(null);
    // The dots stay while the panel is open; the badge updates once it closes.
    if (unread) router.refresh();
  }

  const empty = !checkInCount && !items.length;

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="relative grid size-12 place-items-center rounded-full bg-ink-75 text-ink-700 transition-colors hover:bg-ink-100"
        aria-label={badge ? `Updates: ${badge} new` : "Updates"}
        aria-haspopup="dialog"
      >
        <span className={badge ? "bell-ring" : undefined}>
          <Notification size={22} />
        </span>
        {badge ? (
          <span className="absolute right-2 top-2 grid h-[18px] min-w-[18px] animate-pop place-items-center rounded-full bg-flag-600 px-1 text-[0.6875rem] font-semibold text-white ring-2 ring-white" aria-hidden="true">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      <dialog
        ref={ref}
        aria-labelledby="updates-title"
        onClose={() => {
          if (openOn) hide();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) hide();
        }}
        className="side-sheet m-0 ml-auto h-dvh max-h-none w-full max-w-[420px] bg-white p-0 text-ink-900 shadow-raised backdrop:bg-ink-950/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex h-full flex-col">
          <ModalHeader id="updates-title" title="Updates" description="Messages from us, payment receipts and reminders, all in one place." onClose={hide} closeLabel="Close updates" />

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
            {checkInCount ? (
              <section aria-labelledby="answer-title">
                <h3 id="answer-title" className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Needs your Answer
                </h3>
                <p className="mt-1 text-[0.8125rem] text-ink-600">Any news on these applications? Tap one answer for each.</p>
                <div className="mt-3">{checkIns}</div>
              </section>
            ) : null}

            {items.length ? (
              <section aria-labelledby="latest-title">
                <h3 id="latest-title" className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Latest
                </h3>
                <ul className="stagger mt-2 divide-y divide-ink-100">
                  {items.map((n, i) => {
                    const k = KIND[n.kind];
                    const Icon = k.icon;
                    const inner = (
                      <>
                        <span className={`relative grid size-10 shrink-0 place-items-center rounded-xl ${k.tint}`}>
                          <Icon size={20} variant="bulk" />
                          {n.unread ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-flag-600 ring-2 ring-white" aria-hidden="true" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-ink-500">{k.label}</span>
                            <span className="shrink-0 text-xs text-ink-400">{ago(n.at)}</span>
                          </span>
                          <span className={`mt-0.5 block text-sm text-ink-900 ${n.unread ? "font-semibold" : "font-medium"}`}>
                            {n.title}
                            {n.unread ? <span className="sr-only"> (new)</span> : null}
                          </span>
                          {n.body ? <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-600">{n.body}</span> : null}
                          {n.link ? (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700">
                              Open
                              <ArrowRight2 size={14} />
                            </span>
                          ) : null}
                        </span>
                      </>
                    );
                    return (
                      <li key={n.id} style={{ ["--i" as string]: i }}>
                        {n.link ? (
                          <Link href={n.link} className="-mx-2 flex gap-3 rounded-xl px-2 py-3.5 hover:bg-ink-50">
                            {inner}
                          </Link>
                        ) : (
                          <div className="flex gap-3 py-3.5">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {empty ? (
              <div className="grid place-items-center py-10 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-ink-75 text-ink-600">
                  <Notification size={28} variant="bulk" />
                </span>
                <p className="mt-3 font-semibold text-ink-900">No updates yet</p>
                <p className="mt-1 max-w-[280px] text-sm leading-5 text-ink-600">Messages from us, payment receipts and reminders about your pass or trial will show here.</p>
              </div>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
