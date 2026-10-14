"use client";

import { useRef, useState, useTransition } from "react";
import { reorderItems } from "@/app/(app)/experience/actions";
import type { VaultItem } from "@/lib/vault/data";
import { ArrowUp, ArrowDown, Menu } from "@/components/icons";
import { Spinner } from "@/components/ui/pending-button";

/**
 * Reorder mode for one role's achievements (D-131). The list stays clean until someone
 * asks to reorder; then each line gets a handle to drag (mouse) and Up and Down buttons
 * (touch and keyboard). Nothing is saved until "Save order", and Cancel puts it back.
 */
export function ReorderList({ roleId, items, onDone }: { roleId: string; items: VaultItem[]; onDone: () => void }) {
  const [order, setOrder] = useState(items);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const live = useRef<HTMLParagraphElement>(null);
  const changed = order.some((it, n) => it.id !== items[n]?.id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    setOrder(next);
    setMoved(it!.id);
    if (live.current) live.current.textContent = `Moved to position ${to + 1} of ${next.length}.`;
  };

  const save = () =>
    start(async () => {
      const res = await reorderItems(
        roleId,
        order.map((i) => i.id),
      );
      if (res && !res.ok) setError(res.error);
      else onDone();
    });

  return (
    <div className="animate-rise border-t border-ink-100 bg-brand-50/40 p-3 lg:px-5">
      <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
        <p className="mr-auto text-[0.8125rem] leading-5 text-ink-700">
          <span className="font-semibold text-ink-900">Put your strongest first.</span> Drag a line, or use the arrows. Your CV uses this order.
        </p>
        <button type="button" onClick={onDone} disabled={busy} className="min-h-11 rounded-xl px-3.5 text-sm font-semibold text-ink-600 hover:bg-white">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={busy || !changed} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-150 disabled:text-ink-500">
          {busy ? <Spinner /> : null}
          {busy ? "Saving" : "Save order"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mx-1 mb-2 rounded-xl bg-flag-50 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      ) : null}
      <p ref={live} aria-live="polite" className="sr-only" />
      <ol className="space-y-1.5">
        {order.map((item, n) => (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => {
              setDragging(item.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              const from = order.findIndex((x) => x.id === dragging);
              if (dragging && from !== n) move(from, n);
            }}
            onDragEnd={() => setDragging(null)}
            className={`flex items-center gap-2 rounded-2xl bg-white p-2 pl-1 shadow-card ring-1 transition-[box-shadow,opacity] ${dragging === item.id ? "opacity-50 ring-brand-300" : moved === item.id ? "ring-brand-200" : "ring-ink-150"}`}
          >
            <span className="grid size-9 shrink-0 cursor-grab place-items-center rounded-lg text-ink-400 active:cursor-grabbing" aria-hidden="true">
              <Menu size={18} />
            </span>
            <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-ink-400">{n + 1}</span>
            <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 text-ink-900">{item.text}</span>
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => move(n, n - 1)} disabled={n === 0} aria-label={`Move up: ${item.text.slice(0, 60)}`} className="grid size-10 place-items-center rounded-xl bg-ink-75 text-ink-700 hover:bg-brand-100 hover:text-brand-800 disabled:opacity-30">
                <ArrowUp size={18} />
              </button>
              <button type="button" onClick={() => move(n, n + 1)} disabled={n === order.length - 1} aria-label={`Move down: ${item.text.slice(0, 60)}`} className="grid size-10 place-items-center rounded-xl bg-ink-75 text-ink-700 hover:bg-brand-100 hover:text-brand-800 disabled:opacity-30">
                <ArrowDown size={18} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
