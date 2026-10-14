"use client";

import { useState } from "react";
import { Copy, TickCircle } from "@/components/icons";
import { toast } from "./toaster";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast(`Copied the ${label}.`);
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

/**
 * A block of generated text with its copy icon inside the box, top right, so people
 * copy exactly what's shown. Pops a "Copied" tick when it works.
 */
export function CopyField({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast(`Copied the ${label}.`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  return (
    <div className={`relative rounded-2xl bg-ink-50 ${className}`}>
      <button
        type="button"
        onClick={copy}
        className={`absolute right-2.5 top-2.5 grid size-10 place-items-center rounded-lg border transition-[color,background-color,border-color,transform] active:scale-95 ${
          copied ? "border-proof-100 bg-proof-50 text-proof-700" : "border-ink-150 bg-white text-ink-600 hover:border-brand-200 hover:text-brand-700"
        }`}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? <TickCircle size={20} variant="bulk" className="animate-pop" /> : <Copy size={19} />}
      </button>
      <p className="whitespace-pre-line p-4 pr-16 text-sm leading-6 text-ink-800">{value}</p>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
