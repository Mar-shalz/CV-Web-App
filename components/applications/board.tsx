"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import type { ApplicationStatus } from "@/lib/rules/status-flow";
import { COLUMNS, canDrop, type Column } from "@/lib/applications/board";
import type { SentVia } from "@/lib/applications/sent-via";
import { setStatus, markSentVia } from "@/app/(app)/applications/[id]/actions";
import { SentHowDialog } from "@/components/flow/sent-how";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";
import { ArrowRight2, More, Calendar, Book1 } from "@/components/icons";
import { formatDate } from "@/lib/format";

export type BoardCard = { id: string; title: string; employer: string; status: ApplicationStatus; sentAt: string | null };

/**
 * My Applications as a board, on laptops and tablets (founder round 33, D-201). Drag a job
 * to where it stands now; only the moves the status flow allows light up. Dropping on Sent
 * asks how it went, on Interview opens interview prep, on Not selected asks first. Each
 * card also has a "Move" menu, for keyboards and for anyone who'd rather not drag. Phones
 * keep the list: dragging between columns on a small touch screen fights scrolling.
 */
export function ApplicationsBoard({ cards: initial }: { cards: BoardCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ card: BoardCard; to: "sent" | "rejected" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCards(initial), [initial]);

  const card = (id: string | null) => cards.find((c) => c.id === id) ?? null;
  const moveLocal = (id: string, status: ApplicationStatus, sentAt?: string) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status, sentAt: sentAt ?? c.sentAt } : c)));

  function move(c: BoardCard, col: Column) {
    if (!canDrop(c, col) || !col.drop) return;
    if (col.drop === "sent" || col.drop === "rejected") return setAsking({ card: c, to: col.drop });
    const before = c.status;
    moveLocal(c.id, col.drop);
    start(async () => {
      const res = await setStatus(c.id, col.drop!);
      if (!res.ok) {
        moveLocal(c.id, before);
        return toast(res.error, "error");
      }
      if (res.shortlist) return router.push(`/applications/${c.id}/shortlist`);
      toast(`Moved to ${col.title}.`);
      router.refresh();
    });
  }

  function confirmSent(via: SentVia) {
    if (!asking) return;
    const c = asking.card;
    setError(null);
    start(async () => {
      const res = await markSentVia(c.id, via);
      if (!res.ok) return setError(res.error);
      moveLocal(c.id, "sent", new Date().toISOString());
      setAsking(null);
      toast("Marked as sent. We'll check in with you about it.");
      router.refresh();
    });
  }

  function confirmClosed() {
    if (!asking) return;
    const c = asking.card;
    const before = c.status;
    moveLocal(c.id, "rejected");
    setAsking(null);
    start(async () => {
      const res = await setStatus(c.id, "rejected");
      if (!res.ok) {
        moveLocal(c.id, before);
        return toast(res.error, "error");
      }
      toast("Moved to Not selected.");
      router.refresh();
    });
  }

  const moving = card(dragging);

  return (
    <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-2" aria-busy={busy || undefined}>
      <ol className="flex min-w-max gap-3" aria-label="Applications by stage">
        {COLUMNS.map((col) => {
          const list = cards.filter((c) => col.statuses.includes(c.status));
          const ok = moving ? canDrop(moving, col) : false;
          return (
            <li
              key={col.id}
              aria-label={`${col.title}, ${list.length}`}
              onDragOver={(e) => {
                if (!ok) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== col.id) setOver(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === col.id ? null : o));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const c = card(e.dataTransfer.getData("text/x-application") || dragging);
                setOver(null);
                setDragging(null);
                if (c) move(c, col);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-[var(--radius-card)] p-2 transition-[background-color,opacity,box-shadow] ${
                moving ? (ok ? (over === col.id ? "bg-brand-100 ring-2 ring-brand-500" : "bg-brand-50 outline-2 -outline-offset-2 outline-dashed outline-brand-300") : moving && col.statuses.includes(moving.status) ? "bg-ink-75" : "bg-ink-75 opacity-45") : "bg-ink-75"
              }`}
            >
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <h3 className="text-sm font-semibold text-ink-900">{col.title}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-600 ring-1 ring-ink-150">{list.length}</span>
              </div>
              <ul className="flex min-h-[220px] flex-col gap-2">
                {list.map((c) => (
                  <BoardItem
                    key={c.id}
                    card={c}
                    dragging={dragging === c.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/x-application", c.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(c.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    targets={COLUMNS.filter((x) => canDrop(c, x))}
                    onMove={(x) => move(c, x)}
                  />
                ))}
                {!list.length ? <li className={`grid flex-1 place-items-center rounded-2xl border border-dashed px-3 py-6 text-center text-xs leading-5 ${ok ? "border-brand-400 text-brand-700" : "border-ink-200 text-ink-500"}`}>{ok ? "Drop it here" : col.empty}</li> : null}
              </ul>
            </li>
          );
        })}
      </ol>

      <SentHowDialog open={asking?.to === "sent"} initial={null} busy={busy} error={error} title={asking ? `How did you send ${asking.card.title}?` : undefined} onClose={() => setAsking(null)} onConfirm={confirmSent} />
      <ClosedDialog open={asking?.to === "rejected"} title={asking?.card.title ?? ""} onClose={() => setAsking(null)} onConfirm={confirmClosed} />
    </div>
  );
}

function BoardItem({ card, dragging, onDragStart, onDragEnd, targets, onMove }: { card: BoardCard; dragging: boolean; onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; targets: Column[]; onMove: (c: Column) => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);
  const interview = card.status === "interview" || card.status === "second_interview";
  return (
    <li
      ref={ref}
      draggable={targets.length > 0}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-2xl border border-ink-150 bg-white p-3 shadow-card transition-[opacity,transform] ${targets.length ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "rotate-1 opacity-60" : ""}`}
    >
      <Link href={`/applications/${card.id}`} draggable={false} className="block pr-8">
        <span className="line-clamp-2 text-sm font-semibold leading-5 text-ink-900 group-hover:text-brand-800">{card.title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-500">{card.employer}</span>
        <span className="mt-2 flex items-center gap-1 text-xs text-ink-500">
          <Calendar size={14} />
          {card.sentAt ? `Sent ${formatDate(card.sentAt)}` : "Not sent yet"}
        </span>
      </Link>
      {interview ? (
        <Link href={`/applications/${card.id}/shortlist`} draggable={false} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          <Book1 size={14} /> Interview prep <ArrowRight2 size={12} />
        </Link>
      ) : null}
      {targets.length ? (
        <>
          <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label={`Move ${card.title}`} className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-75 hover:text-ink-900">
            <More size={18} />
          </button>
          {menu ? (
            <ul role="menu" aria-label="Move to" className="absolute right-2 top-10 z-30 w-44 animate-pop rounded-xl border border-ink-150 bg-white p-1 shadow-raised">
              <li className="px-2.5 pb-1 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-400">Move to</li>
              {targets.map((t) => (
                <li key={t.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onMove(t);
                    }}
                    className="flex min-h-10 w-full items-center rounded-lg px-2.5 text-left text-sm text-ink-800 hover:bg-brand-50"
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

function ClosedDialog({ open, title, onClose, onConfirm }: { open: boolean; title: string; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby="closed-title" onClose={onClose} className="m-auto w-[min(92vw,440px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
      <ModalHeader id="closed-title" title="Not selected this time?" description={`This closes ${title}. You can't move it on afterwards, so do it once they've told you.`} onClose={onClose} />
      <div className="grid gap-2 px-5 pb-6 pt-2 sm:grid-cols-2 sm:px-7">
        <Button variant="secondary" onClick={onClose}>
          Keep it open
        </Button>
        <Button onClick={onConfirm}>Yes, close it</Button>
      </div>
    </dialog>
  );
}
