"use client";

import { Children, useSyncExternalStore, type ReactNode } from "react";

// Tailwind's 2xl breakpoint: two columns of role cards from here up.
const WIDE = "(min-width: 96rem)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * Role cards in two independent columns on wide screens (D-131): opening a card on the
 * right only moves the cards below it on the right, never the left. Narrower screens
 * get one column, in order.
 */
export function RoleColumns({ children }: { children: ReactNode }) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);
  const cards = Children.toArray(children);
  if (!wide || cards.length < 2) return <div className="flex flex-col gap-3">{cards}</div>;
  return (
    <div className="grid grid-cols-2 items-start gap-3">
      <div className="flex flex-col gap-3">{cards.filter((_, i) => i % 2 === 0)}</div>
      <div className="flex flex-col gap-3">{cards.filter((_, i) => i % 2 === 1)}</div>
    </div>
  );
}
