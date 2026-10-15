"use client";

import { useState, useTransition } from "react";
import { shareCheck } from "@/app/(app)/jobs/actions";
import { toast } from "@/components/ui/toaster";
import { Share, Copy } from "@/components/icons";
import { WhatsAppLogo, XLogo } from "@/components/brand/social-logos";
import { Spinner } from "@/components/ui/pending-button";

type Verdict = "verified" | "unverified" | "red_flags";

const VERDICT_WORDS: Record<Verdict, string> = { verified: "looks genuine on the checks", unverified: "couldn't be confirmed", red_flags: "showed warning signs" };

/**
 * Share a job check (D-147): a public link with the verdict and what was checked, never who
 * checked it. WhatsApp first (it's where job posts travel in Nigeria), then X, copy, and the
 * phone's own share sheet.
 */
export function ShareCheck({ jobId, state, calm = false, title, employer }: { jobId: string; state: Verdict; calm?: boolean; title: string | null; employer: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const job = [title, employer && `at ${employer}`].filter(Boolean).join(" ") || "this job";
  const text = `I checked ${job} before applying: it ${calm && state === "unverified" ? "showed no warning signs" : VERDICT_WORDS[state]}. See what was checked, and check your own job free:`;

  const make = () =>
    start(async () => {
      setError(null);
      const res = await shareCheck(jobId);
      if (!res.ok) return setError(res.error);
      setUrl(`${location.origin}/c/${res.slug}`);
    });

  if (!url)
    return (
      <div>
        <button type="button" onClick={make} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-brand-600 bg-white px-4 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-progress disabled:opacity-70">
          {busy ? <Spinner /> : <Share size={18} />}
          {busy ? "Making the link" : "Share this check"}
        </button>
        {error ? <p className="mt-1.5 text-xs text-flag-700">{error}</p> : null}
      </div>
    );

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  const x = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  return (
    <div className="animate-rise rounded-2xl bg-ink-50 p-3">
      <p className="text-[0.8125rem] font-semibold text-ink-900">Share the check</p>
      <p className="text-xs text-ink-500">The link shows the job and what we found. Never your name or details.</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#1f9d55] px-3 text-sm font-semibold text-white hover:bg-[#188247]">
          <WhatsAppLogo size={19} />
          WhatsApp
        </a>
        <a href={x} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-ink-900 px-3 text-sm font-semibold text-white hover:bg-ink-800">
          <XLogo size={15} />
          Post on X
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast("Link copied.");
            } catch {
              setError("Copy didn't work. Long-press the link to copy it.");
            }
          }}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-ink-800 ring-1 ring-ink-150 hover:bg-ink-75"
        >
          <Copy size={18} />
          Copy link
        </button>
        <button
          type="button"
          onClick={() => {
            if (navigator.share) void navigator.share({ title: "Job check", text, url }).catch(() => {});
            else window.open(whatsapp, "_blank", "noopener");
          }}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-ink-800 ring-1 ring-ink-150 hover:bg-ink-75"
        >
          <Share size={18} />
          More
        </button>
      </div>
      <p className="mt-2 break-all text-xs text-ink-500">{url}</p>
      {error ? <p className="mt-1 text-xs text-flag-700">{error}</p> : null}
    </div>
  );
}
