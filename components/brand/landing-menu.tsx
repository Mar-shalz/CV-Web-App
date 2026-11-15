"use client";

import { useRef } from "react";

/**
 * The landing page's phone menu. A solid panel (founder round 43: the see-through one let the
 * hero's headline show through the links), and it closes when a link is tapped. Light since
 * round 50, to match the light bar.
 */
export function LandingMenu({ links }: { links: [string, string][] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    // The panel spans the sticky nav, inside its 12px gutter like the bar above, so it never runs off a small screen.
    <details ref={ref} className="lg:hidden">
      <summary className="grid size-12 cursor-pointer list-none place-items-center rounded-full hover:bg-ink-100 [&::-webkit-details-marker]:hidden" aria-label="Menu">
        <span aria-hidden="true" className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 rounded bg-ink-900" />
          <span className="block h-0.5 w-5 rounded bg-ink-900" />
        </span>
      </summary>
      <ul className="absolute inset-x-3 top-full z-50 mt-2 rounded-3xl bg-white p-2 text-[1.0625rem] font-medium shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_30px_60px_-20px_rgb(15_23_42/0.35)]">
        {links.map(([label, href]) => (
          <li key={href}>
            <a href={href} onClick={() => ref.current?.removeAttribute("open")} className="flex min-h-12 items-center rounded-2xl px-4 text-ink-900 hover:bg-ink-75 focus-visible:bg-ink-75">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
