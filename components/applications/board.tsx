"use client";

import { useEffect, useId, useRef, useState, useTransition, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import type { ApplicationStatus } from "@/lib/rules/status-flow";
import { COLUMNS, canDrop, needsSend, reachedFar, type Column, type Drop } from "@/lib/applications/board";
import type { SentVia } from "@/lib/applications/sent-via";
import { moveOnBoard, markSentVia, prepLater } from "@/app/(app)/applications/[id]/actions";
import { SentHowDialog } from "@/components/flow/sent-how";
import { Consolation } from "./consolation";
import { prepSeenKey } from "@/components/notifications/prep-nudge";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";
import type { IconProps } from "@/components/icons/make";
import { ArrowRight2, More, Book1, DocumentText, Send2, TaskSquare, Teacher, Star1, Clock, CloseCircle, Archive, InfoCircle } from "@/components/icons";
import { formatDate } from "@/lib/format";

export type BoardCard = { id: string; title: string; employer: string; status: ApplicationStatus; sentAt: string | null; via: string | null };
export type SavedJob = { id: string; title: string; employer: string; savedAt: string };

const ICONS: Record<string, ComponentType<IconProps>> = { not_sent: DocumentText, sent: Send2, assessment: TaskSquare, interview: Teacher, offer: Star1, no_reply: Clock, closed: CloseCircle };
/** Employer initials on a colour picked from the name, so the same employer always looks the same. */
const AVATARS = ["bg-indigo-600", "bg-blue-600", "bg-violet-600", "bg-teal-700", "bg-green-700", "bg-amber-700", "bg-rose-600", "bg-sky-700", "bg-fuchsia-700"];
const avatar = (name: string) => AVATARS[[...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATARS.length];
const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

type Asking = { card: BoardCard; kind: "send"; then: Drop } | { card: BoardCard; kind: "close" } | null;

/**
 * My Applications as a board, on laptops and tablets (founder rounds 33 and 34, D-201,
 * D-202). Drag a job to where it stands, back or forward, skipping stages; only Not selected
 * is final. A job not sent yet asks how it was sent first. Interview asks whether they're
 * ready to prepare (Later reminds them on the next visit); Not selected asks first, then
 * says a warm word. Each card has a "Move" menu for keyboards and anyone who'd rather not
 * drag. Phones keep the list: dragging between columns on a small touch screen fights
 * scrolling.
 */
export function ApplicationsBoard({ cards: initial, saved, toolbar }: { cards: BoardCard[]; saved: SavedJob[]; toolbar?: ReactNode }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [asking, setAsking] = useState<Asking>(null);
  const [ready, setReady] = useState<BoardCard | null>(null);
  const [consoling, setConsoling] = useState<{ card: BoardCard; reached: boolean } | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCards(initial), [initial]);

  const card = (id: string | null) => cards.find((c) => c.id === id) ?? null;
  const local = (id: string, status: ApplicationStatus) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
  const statusFor = (to: Drop): ApplicationStatus => (to === "unsent" ? "packed" : to);

  /** After a move lands: interview asks about prep, a no gets a warm word, the rest a toast. */
  function landed(c: BoardCard, to: Drop, before: ApplicationStatus) {
    if (to === "interview") setReady(c);
    else if (to === "rejected") setConsoling({ card: c, reached: reachedFar(before) });
    else toast(`Moved to ${COLUMNS.find((x) => x.drop === to)?.title ?? "its new stage"}.`);
    router.refresh();
  }

  function move(c: BoardCard, col: Column) {
    if (!canDrop(c, col) || !col.drop) return;
    if (needsSend(c, col)) return setAsking({ card: c, kind: "send", then: col.drop });
    if (col.drop === "rejected") return setAsking({ card: c, kind: "close" });
    apply(c, col.drop);
  }

  function apply(c: BoardCard, to: Drop) {
    const before = c.status;
    local(c.id, statusFor(to));
    start(async () => {
      const res = await moveOnBoard(c.id, to);
      if (!res.ok) {
        local(c.id, before);
        return toast(res.error, "error");
      }
      landed(c, to, before);
    });
  }

  function confirmSent(via: SentVia) {
    if (asking?.kind !== "send") return;
    const { card: c, then } = asking;
    setError(null);
    start(async () => {
      const res = await markSentVia(c.id, via, then === "unsent" ? undefined : then);
      if (!res.ok) return setError(res.error);
      setAsking(null);
      local(c.id, statusFor(then));
      if (then === "sent") {
        toast("Marked as sent. We'll check in with you about it.");
        router.refresh();
      } else landed(c, then, "sent");
    });
  }

  function later(c: BoardCard) {
    setReady(null);
    try {
      sessionStorage.setItem(prepSeenKey(`/applications/${c.id}/shortlist`), "1");
    } catch {}
    start(async () => {
      await prepLater(c.id);
      toast("We'll remind you about it next time you open the app.");
      router.refresh();
    });
  }

  const moving = card(dragging);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.8125rem] text-ink-600">Drag a job to where it stands now, forward or back. Only Not selected is final. Moving one to Interview offers interview prep.</p>
          {saved.length ? (
            <p className="text-[0.8125rem] text-ink-600">
              {saved.length} saved {saved.length === 1 ? "job isn't" : "jobs aren't"} on the board.{" "}
              <button type="button" onClick={() => setShowSaved(true)} className="font-semibold text-brand-700 hover:underline">
                See saved jobs
              </button>
            </p>
          ) : null}
        </div>
        {toolbar}
      </div>

      <div className="rounded-[var(--radius-panel)] border border-ink-150 bg-white p-3 shadow-card" aria-busy={busy || undefined}>
        <div className="no-scrollbar overflow-x-auto">
          <ol className="flex min-w-max gap-3" aria-label="Applications by stage">
            {COLUMNS.map((col) => {
              const list = cards.filter((c) => col.statuses.includes(c.status));
              const ok = moving ? canDrop(moving, col) : false;
              const home = moving ? col.statuses.includes(moving.status) : false;
              const Icon = ICONS[col.id] ?? DocumentText;
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
                  className={`flex w-[17rem] shrink-0 flex-col transition-opacity ${moving && !ok && !home ? "opacity-40" : ""}`}
                >
                  <div className="flex h-11 overflow-hidden rounded-xl shadow-sm">
                    <h3 className={`flex flex-1 items-center gap-2 px-3 text-sm font-semibold text-white ${col.solid}`}>
                      <Icon size={18} variant="bulk" />
                      {col.title}
                    </h3>
                    <span className={`grid min-w-12 place-items-center px-3 text-sm font-semibold tabular-nums ${col.tint}`}>{list.length}</span>
                  </div>
                  <ul className={`mt-2.5 flex h-[calc(100dvh-17rem)] min-h-[24rem] flex-col gap-2.5 overflow-y-auto rounded-xl p-2 transition-colors ${over === col.id ? "bg-brand-50 ring-2 ring-brand-400" : ok ? "bg-brand-50/60" : "bg-ink-75"}`}>
                    {over === col.id ? <li aria-hidden="true" className="h-20 shrink-0 rounded-xl border-2 border-dashed border-brand-300 bg-[repeating-linear-gradient(135deg,var(--color-ink-100)_0_8px,transparent_8px_16px)]" /> : null}
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
                    {!list.length && over !== col.id ? <li className={`grid flex-1 place-items-center rounded-xl border border-dashed px-4 text-center text-xs leading-5 ${ok ? "border-brand-400 text-brand-700" : "border-ink-200 text-ink-500"}`}>{ok ? "Drop it here" : col.empty}</li> : null}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <SentHowDialog
        open={asking?.kind === "send"}
        initial={null}
        busy={busy}
        error={error}
        title={asking ? `First, how did you send ${asking.card.title}?` : undefined}
        onClose={() => setAsking(null)}
        onConfirm={confirmSent}
      />
      <Confirm
        open={asking?.kind === "close"}
        title="Not selected this time?"
        body={asking ? `This closes ${asking.card.title}, and it stays closed. Do it once ${asking.card.employer} has told you.` : ""}
        no="Keep it open"
        yes="Yes, close it"
        onClose={() => setAsking(null)}
        onYes={() => {
          const c = asking?.card;
          setAsking(null);
          if (c) apply(c, "rejected");
        }}
      />
      <Confirm
        open={Boolean(ready)}
        icon={<Teacher size={28} variant="bulk" />}
        title={ready ? `Invited to interview at ${ready.employer}!` : ""}
        body="Well done: your application did its job. Ready to prepare? We'll go through the likely questions and a mock interview by voice. It takes about 10 minutes."
        no="Later"
        yes="Yes, let's prepare"
        onClose={() => ready && later(ready)}
        onYes={() => {
          const c = ready;
          setReady(null);
          if (c) router.push(`/applications/${c.id}/shortlist`);
        }}
      />
      <Consolation open={Boolean(consoling)} reached={consoling?.reached ?? false} employer={consoling?.card.employer ?? null} onClose={() => setConsoling(null)} />
      <SavedJobs open={showSaved} jobs={saved} onClose={() => setShowSaved(false)} />
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
  const tag = "rounded-md border border-ink-150 bg-white px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink-600";
  return (
    <li
      ref={ref}
      draggable={targets.length > 0}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative shrink-0 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgb(16_24_40/0.06)] ring-1 ring-ink-150 transition-[box-shadow,transform,opacity] hover:shadow-card hover:ring-brand-200 ${targets.length ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "rotate-2 scale-[1.02] opacity-70 shadow-raised" : ""}`}
    >
      <Link href={`/applications/${card.id}`} draggable={false} className="flex gap-3 pr-7">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${avatar(card.employer)}`} aria-hidden="true">
          {initials(card.employer)}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-semibold leading-5 text-ink-900 group-hover:text-brand-800">{card.title}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-500">{card.employer}</span>
        </span>
      </Link>
      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[3.25rem]">
        <span className={tag}>{card.sentAt ? `Sent ${formatDate(card.sentAt)}` : "Not sent yet"}</span>
        {card.via ? <span className={tag}>{card.via}</span> : null}
        {card.status === "second_interview" ? <span className={tag}>2nd interview</span> : null}
        {card.status === "accepted" ? <span className={tag}>Accepted</span> : null}
        {card.status === "withdrawn" ? <span className={tag}>Withdrawn</span> : null}
        {interview ? (
          <Link href={`/applications/${card.id}/shortlist`} draggable={false} className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-teal-800 hover:bg-teal-100">
            <Book1 size={12} /> Interview prep <ArrowRight2 size={10} />
          </Link>
        ) : null}
      </div>
      {targets.length ? (
        <>
          <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label={`Move ${card.title}`} className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-75 hover:text-ink-900">
            <More size={18} />
          </button>
          {menu ? (
            <ul role="menu" aria-label="Move to" className="absolute right-1.5 top-10 z-30 w-48 animate-pop rounded-xl border border-ink-150 bg-white p-1 shadow-raised">
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
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-ink-800 hover:bg-brand-50"
                  >
                    <span className={`size-2.5 rounded-full ${t.solid}`} aria-hidden="true" />
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

/** A two button question in a sheet. `onClose` is the "no" answer (Escape and the cross too). */
function Confirm({ open, title, body, no, yes, icon, onClose, onYes }: { open: boolean; title: string; body: string; no: string; yes: string; icon?: ReactNode; onClose: () => void; onYes: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const answered = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      answered.current = false;
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (!answered.current) onClose();
      }}
      className="m-auto w-[min(92vw,460px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop"
    >
      {icon ? (
        <div className="px-5 pt-6 sm:px-7">
          <span className="grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">{icon}</span>
        </div>
      ) : null}
      <ModalHeader id={titleId} title={title} description={body} onClose={() => ref.current?.close()} />
      <div className="grid gap-2 px-5 pb-6 pt-2 sm:grid-cols-2 sm:px-7">
        <Button variant="secondary" onClick={() => ref.current?.close()}>
          {no}
        </Button>
        <Button
          onClick={() => {
            answered.current = true;
            ref.current?.close();
            onYes();
          }}
        >
          {yes}
        </Button>
      </div>
    </dialog>
  );
}

/** Saved jobs, from the board (D-202): pick one to open its check. */
function SavedJobs({ open, jobs, onClose }: { open: boolean; jobs: SavedJob[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby="saved-title" onClose={onClose} className="m-auto w-[min(92vw,520px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
      <ModalHeader id="saved-title" title="Saved for later" description="Jobs you saved to look at again. Open one to check it and tailor your CV." onClose={() => ref.current?.close()} />
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto px-5 pb-6 sm:px-7">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link href={`/jobs/${j.id}/check`} onClick={() => ref.current?.close()} className="group flex items-center gap-3 rounded-2xl border border-ink-150 bg-white p-3 transition-colors hover:border-brand-200 hover:bg-brand-50">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-75 text-ink-700">
                <Archive size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{j.title}</span>
                <span className="block truncate text-xs text-ink-500">
                  {j.employer} · Saved {formatDate(j.savedAt)}
                </span>
              </span>
              <ArrowRight2 size={16} className="shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
        {!jobs.length ? (
          <li className="flex items-center gap-2 text-sm text-ink-600">
            <InfoCircle size={16} /> No saved jobs.
          </li>
        ) : null}
      </ul>
    </dialog>
  );
}
