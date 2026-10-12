"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the payment every few seconds while Paystack confirms, for up to 3 minutes. */
export function AutoRefresh({ everyMs = 4000, forMs = 180_000 }: { everyMs?: number; forMs?: number }) {
  const router = useRouter();
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > forMs) {
        clearInterval(t);
        setStopped(true);
        return;
      }
      router.refresh();
    }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs, forMs]);
  return stopped ? (
    <button type="button" onClick={() => router.refresh()} className="mt-4 min-h-12 rounded-2xl border border-ink-200 bg-white px-5 font-semibold text-ink-900 hover:bg-ink-50">
      Check again
    </button>
  ) : null;
}
