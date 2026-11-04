"use client";

import { useRef } from "react";

/**
 * The landing page's phone menu. A solid panel (founder round 43: the see-through one let the
 * hero's headline show through the links), and it closes when a link is tapped.
 */
export function LandingMenu({ links }: { links: [string, string][] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    // The panel spans the sticky nav, inside its 12px gutter like the bar above, so it never runs off a small screen.
    <details ref={ref} className="lg:hidden">
      <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl text-white hover:bg-white/10" aria-label="Menu">
        <span aria-hidden="true" className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 rounded bg-white" />
          <span className="block h-0.5 w-5 rounded bg-white" />
        </span>
      </summary>
      <ul className="lp-menu absolute inset-x-3 top-full z-50 mt-2 rounded-2xl p-2 text-[0.9375rem] font-medium">
        {links.map(([label, href]) => (
          <li key={href}>
            <a href={href} onClick={() => ref.current?.removeAttribute("open")} className="flex min-h-12 items-center rounded-xl px-3.5 text-white hover:bg-white/10 focus-visible:bg-white/10">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
