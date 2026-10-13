"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MODAL_PATHS } from "@/components/ui/modal-routes";

const START = "rcpt:nav-start";

/** Starts the top bar for navigations made in code (router.push), not by a link tap. */
export function startNavProgress() {
  window.dispatchEvent(new Event(START));
}

/**
 * A thin bar at the top of the screen from the moment a link is tapped until the next
 * page is on screen, so a tap never looks ignored while the server works. The cursor
 * shows "busy" too. It finishes on its own after 12 seconds if nothing changes.
 */
export function NavProgress() {
  const route = `${usePathname()}?${useSearchParams().toString()}`;
  const routeRef = useRef(route);
  // The page we were on when the tap happened; null when nothing is loading.
  const [from, setFrom] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = from === null ? "idle" : from === route ? "loading" : "done";

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    const start = () => {
      setFrom(routeRef.current);
      document.documentElement.dataset.navigating = "";
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFrom(null), 12_000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      // Modal screens open their own frame at once, so no bar for them.
      if (MODAL_PATHS.includes(url.pathname)) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(START, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START, start);
    };
  }, []);

  // The next page is on screen: finish the bar, then reset.
  useEffect(() => {
    if (phase === "loading") return;
    delete document.documentElement.dataset.navigating;
    if (phase !== "done") return;
    if (timer.current) clearTimeout(timer.current);
    const t = setTimeout(() => setFrom(null), 350);
    return () => clearTimeout(t);
  }, [phase]);

  return <div aria-hidden="true" data-phase={phase} className="nav-progress" />;
}
