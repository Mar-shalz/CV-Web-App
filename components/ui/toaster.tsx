"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TickCircle, InfoCircle, Danger, CloseCircle } from "@/components/icons";

type Tone = "ok" | "info" | "error";
type Toast = { id: number; message: string; tone: Tone };

const EVENT = "rcpt:toast";
const COOKIE = "rcpt_toast";

/** Shows a toast from client code: toast("Copied"). Server actions use flash() instead. */
export function toast(message: string, tone: Tone = "ok") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, tone } }));
}

function takeCookie(): { m: string; t: Tone } | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
  let value = raw.slice(COOKIE.length + 1);
  // Decoded until it reads as JSON (once from the server, possibly twice from other code).
  for (let i = 0; i < 3; i++) {
    try {
      const v = JSON.parse(value) as { m?: unknown; t?: unknown };
      return typeof v.m === "string" ? { m: v.m, t: v.t === "error" || v.t === "info" ? v.t : "ok" } : null;
    } catch {
      try {
        value = decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }
  return null;
}

const TONE = {
  ok: { icon: TickCircle, cls: "text-proof-400" },
  info: { icon: InfoCircle, cls: "text-sky-300" },
  error: { icon: Danger, cls: "text-flag-400" },
} as const;

/**
 * One place for "done" notices, centred at the top of the screen (D-121). Picks up
 * toast() calls and notices that server actions leave in a short cookie, after a
 * redirect or in place. Each one closes by itself after 4 seconds.
 */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(1);
  const box = useRef<HTMLDivElement>(null);
  const route = `${usePathname()}?${useSearchParams().toString()}`;

  const push = useCallback((message: string, tone: Tone) => {
    const id = next.current++;
    setItems((list) => [...list.filter((t) => t.message !== message), { id, message, tone }].slice(-3));
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === "error" ? 6000 : 4000);
  }, []);

  const check = useCallback(() => {
    const c = takeCookie();
    if (c) push(c.m, c.t);
  }, [push]);

  // A server action's notice: after it redirects (route change) or in place (cookie change).
  useEffect(() => {
    check();
  }, [route, check]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<{ message: string; tone: Tone }>).detail;
      if (d?.message) push(d.message, d.tone);
    };
    window.addEventListener(EVENT, onToast);
    // Cookie Store API where the browser has it; otherwise a cheap look once a second.
    const store = (window as unknown as { cookieStore?: EventTarget }).cookieStore;
    let timer: number | undefined;
    if (store) store.addEventListener("change", check);
    else timer = window.setInterval(check, 1000);
    return () => {
      window.removeEventListener(EVENT, onToast);
      if (store) store.removeEventListener("change", check);
      if (timer) window.clearInterval(timer);
    };
  }, [push, check]);

  // A popover sits in the top layer, so a toast shows above an open modal too.
  useEffect(() => {
    const el = box.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el?.showPopover) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover?.();
      if (items.length) el.showPopover();
    } catch {
      // Older browsers: the fixed position below still shows it.
    }
  }, [items]);

  return (
    <div
      ref={box}
      popover="manual"
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-auto top-3 z-[1000] m-0 flex w-full flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4"
    >
      {items.map((t) => {
        const { icon: Icon, cls } = TONE[t.tone];
        return (
          <div key={t.id} className="toast pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-ink-950/95 py-2.5 pl-3.5 pr-2 text-sm font-medium text-white shadow-raised backdrop-blur">
            <Icon size={20} variant="bulk" className={`shrink-0 ${cls}`} />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close notice"
            >
              <CloseCircle size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
