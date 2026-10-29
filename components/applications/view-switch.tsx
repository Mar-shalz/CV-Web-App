"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Element3, Menu } from "@/components/icons";

type View = "board" | "list";
const KEY = "applications-view";

/**
 * Board or list on laptops and tablets (D-201), remembered on this device. Phones always
 * get the list: a board needs room, and dragging fights scrolling on a small touch screen.
 */
export function ViewSwitch({ board, list }: { board: ReactNode; list: ReactNode }) {
  const [view, setView] = useState<View>("board");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === "list") setView("list");
    } catch {}
  }, []);
  const pick = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };
  return (
    <>
      <div role="tablist" aria-label="Show applications as" className="hidden w-fit gap-1 rounded-2xl bg-white p-1 ring-1 ring-ink-150 lg:flex">
        {(
          [
            ["board", "Board", Element3],
            ["list", "List", Menu],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => pick(v)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors ${view === v ? "bg-brand-900 text-white" : "text-ink-600 hover:bg-ink-75 hover:text-ink-900"}`}
          >
            <Icon size={16} variant={view === v ? "bulk" : "linear"} />
            {label}
          </button>
        ))}
      </div>
      <div className={view === "board" ? "hidden lg:block" : "hidden"}>{board}</div>
      <div className={view === "board" ? "space-y-3 lg:hidden" : "space-y-3"}>{list}</div>
    </>
  );
}
