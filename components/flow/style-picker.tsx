"use client";

import { useEffect, useState } from "react";
import { CV_STYLES, CV_STYLE_INFO, type CvStyle } from "@/lib/cv/styles";
import { requestDesign } from "@/app/(app)/cv/actions";
import { toast } from "@/components/ui/toaster";

// Mirrors lib/cv/design-usage.ts (server only), the reasons people can pick.
const REASONS = ["More colour", "Fits on one page", "Two columns", "With a photo", "More creative", "Something else"] as const;

/** "None of these?": one tap to say what design they wanted. Counted, so new designs follow demand (D-148). */
function AskForDesign() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) return <p className="mt-2 text-xs font-medium text-proof-700">Thanks. We add the designs people ask for most.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-brand-700 underline-offset-2 hover:underline">
        None of these? Tell us what you&apos;d like
      </button>
    );
  return (
    <div className="mt-2 animate-rise">
      <p className="text-xs text-ink-600">What would you like?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setSent(true);
              void requestDesign(r).then(() => toast("Thanks. We add the designs people ask for most."));
            }}
            className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-ink-700 ring-1 ring-ink-150 hover:bg-brand-50 hover:text-brand-800"
          >
            {r}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[0.6875rem] leading-4 text-ink-500">Two columns and photos can stop hiring software reading a CV, so we only add them if many people ask.</p>
    </div>
  );
}

const KEY = "rcpt-cv-style";

/** The CV design last chosen on this device (a convenience only; every download says which). */
export function useCvStyle(): [CvStyle, (s: CvStyle) => void] {
  const [style, setStyle] = useState<CvStyle>("classic");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && (CV_STYLES as readonly string[]).includes(saved)) setStyle(saved as CvStyle);
    } catch {}
  }, []);
  const choose = (s: CvStyle) => {
    setStyle(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {}
  };
  return [style, choose];
}

/** A tiny drawing of each design's header and headings, so the choice is visual. */
function Thumb({ s }: { s: CvStyle }) {
  const accent = s === "modern" ? "bg-brand-600" : s === "executive" ? "bg-ink-900" : s === "signature" ? "bg-[#0a7878]" : "bg-brand-900";
  if (s === "signature")
    return (
      <span aria-hidden="true" className="flex h-16 w-full flex-col overflow-hidden rounded-lg bg-white ring-1 ring-ink-150">
        <span className="flex h-6 flex-col justify-center gap-0.5 bg-[#0a3340] px-2">
          <span className="h-1.5 w-10 rounded-full bg-white" />
          <span className="h-1 w-8 rounded-full bg-[#bde6e6]" />
        </span>
        <span className="h-0.5 w-full bg-[#0a7878]" />
        <span className="flex flex-col gap-1 p-1.5">
          <span className="flex items-center gap-1">
            <span className="size-1.5 bg-[#0a7878]" />
            <span className="h-1 w-6 rounded-full bg-[#0a7878]" />
          </span>
          <span className="h-1 w-full rounded-full bg-ink-150" />
          <span className="h-1 w-4/5 rounded-full bg-ink-150" />
        </span>
      </span>
    );
  return (
    <span aria-hidden="true" className={`flex h-16 w-full flex-col gap-1 rounded-lg bg-white p-2 ring-1 ring-ink-150 ${s === "executive" ? "font-serif" : ""}`}>
      <span className={`h-1.5 w-10 rounded-full ${s === "modern" ? accent : "mx-auto bg-ink-800"}`} />
      <span className={`h-1 w-14 rounded-full bg-ink-200 ${s === "modern" ? "" : "mx-auto"}`} />
      <span className={`mt-0.5 h-px w-full ${s === "modern" ? "bg-transparent" : accent}`} />
      <span className={`h-1 w-8 rounded-full ${accent}`} />
      <span className="h-1 w-full rounded-full bg-ink-150" />
      <span className="h-1 w-4/5 rounded-full bg-ink-150" />
    </span>
  );
}

/**
 * Pick a CV design before downloading (D-142). All three are single column with real text,
 * so applicant tracking systems read them the same way.
 */
export function StylePicker({ value, onChange }: { value: CvStyle; onChange: (s: CvStyle) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink-900">Design</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CV_STYLES.map((s) => (
          <label key={s} className={`cursor-pointer rounded-2xl p-2 ring-1 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500 ${value === s ? "bg-brand-50 ring-2 ring-brand-500" : "bg-ink-50 ring-ink-150 hover:bg-ink-75"}`}>
            <input type="radio" name="cv-style" value={s} checked={value === s} onChange={() => onChange(s)} className="sr-only" />
            <Thumb s={s} />
            <span className="mt-1.5 block text-center text-[0.8125rem] font-semibold text-ink-900">{CV_STYLE_INFO[s].label}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-ink-500">
        {CV_STYLE_INFO[value].note} Font: {CV_STYLE_INFO[value].font} ({CV_STYLE_INFO[value].wordFont} in Word). All four read cleanly in applicant tracking systems.
      </p>
      <AskForDesign />
    </fieldset>
  );
}
