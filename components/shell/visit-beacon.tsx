"use client";

import { useEffect } from "react";
import { markVisit } from "@/app/(app)/visit-action";

const KEY = "rcpt_visit_at";
const GAP_MS = 30 * 60_000;

/**
 * Counts a visit when someone opens the app, and again only after 30 minutes away, so
 * moving between pages or refreshing never adds visits (D-110). Silent if storage fails.
 */
export function VisitBeacon() {
  useEffect(() => {
    const ping = () => {
      let last = 0;
      try {
        last = Number(localStorage.getItem(KEY) ?? 0);
      } catch {}
      if (Date.now() - last < GAP_MS) return;
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {}
      void markVisit().catch(() => {});
    };
    ping();
    const onShow = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
  return null;
}
