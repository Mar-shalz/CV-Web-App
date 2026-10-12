"use client";

import { useState } from "react";
import { Copy, TickCircle } from "@/components/icons";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
        copied ? "bg-proof-50 text-proof-700" : "bg-ink-75 text-ink-700 hover:bg-ink-100"
      }`}
    >
      {copied ? <TickCircle size={18} variant="bulk" /> : <Copy size={18} />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      <span className="sr-only"> {label}</span>
    </button>
  );
}
