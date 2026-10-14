"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { connectExtension, disconnectAll } from "@/app/(app)/extension/actions";
import { Global, TickCircle, Warning2, Logout } from "@/components/icons";
import { Spinner } from "@/components/ui/pending-button";

type State = "waiting" | "connecting" | "connected" | "missing" | "error";

/**
 * Signs the browser extension in (D-144). The extension's helper on this page says hello;
 * the page then makes a key for it and hands it over inside this tab only (window
 * messages to our own address). If no extension answers, the page says how to add it.
 */
export function ConnectExtension({ name }: { name: string }) {
  const [state, setState] = useState<State>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const sent = useRef(false);

  useEffect(() => {
    const connect = async () => {
      if (sent.current) return;
      sent.current = true;
      setState("connecting");
      const label = /Edg\//.test(navigator.userAgent) ? "Edge" : /Brave/.test(navigator.userAgent) ? "Brave" : "Chrome";
      const res = await connectExtension(label);
      if (!res.ok) {
        setError(res.error);
        setState("error");
        sent.current = false;
        return;
      }
      window.postMessage({ source: "receipts-app", type: "connect", token: res.token, name: res.name }, location.origin);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== location.origin) return;
      const d = e.data as { source?: string; type?: string } | null;
      if (d?.source !== "receipts-extension") return;
      if (d.type === "hello") void connect();
      if (d.type === "connected") setState("connected");
    };
    window.addEventListener("message", onMessage);
    // Ask, in case the helper said hello before this page was listening.
    window.postMessage({ source: "receipts-app", type: "ping" }, location.origin);
    const t = setTimeout(() => setState((s) => (s === "waiting" ? "missing" : s)), 2500);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, []);

  return (
    <section className="animate-rise rounded-[var(--radius-panel)] border border-ink-150 bg-white p-6 text-center shadow-card sm:p-8">
      <span className={`mx-auto grid size-16 place-items-center rounded-3xl ${state === "connected" ? "bg-proof-50 text-proof-600" : state === "missing" || state === "error" ? "bg-care-50 text-care-600" : "bg-brand-50 text-brand-700"}`}>
        {state === "connected" ? <TickCircle size={34} variant="bulk" /> : state === "missing" || state === "error" ? <Warning2 size={32} variant="bulk" /> : <Global size={32} variant="bulk" />}
      </span>
      {state === "connected" ? (
        <>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900">You&apos;re Connected</h1>
          <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
            The extension is signed in as <span className="font-semibold text-ink-900">{name}</span>. You can close this tab and go back to the job you were looking at.
          </p>
        </>
      ) : state === "missing" ? (
        <>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900">Add the Extension First</h1>
          <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">We couldn&apos;t find the Receipts extension in this browser. Add it, then open it and tap Sign in.</p>
          <Link href="/extension" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
            How to add it
          </Link>
        </>
      ) : state === "error" ? (
        <>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900">That Didn&apos;t Work</h1>
          <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">{error}</p>
          <button type="button" onClick={() => location.reload()} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
            Try again
          </button>
        </>
      ) : (
        <>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900">Connecting the Extension</h1>
          <p className="mt-2 flex items-center justify-center gap-2 text-[0.9375rem] text-ink-600">
            <Spinner />
            Signing it in as {name}…
          </p>
        </>
      )}
      <div className="mt-8 border-t border-ink-100 pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => start(() => disconnectAll())}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-flag-50 hover:text-flag-700"
        >
          <Logout size={18} />
          Sign the extension out on every browser
        </button>
      </div>
    </section>
  );
}
