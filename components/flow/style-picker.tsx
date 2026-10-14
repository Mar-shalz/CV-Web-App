"use client";

import { useEffect, useState } from "react";
import { CV_STYLES, CV_STYLE_INFO, type CvStyle } from "@/lib/cv/styles";

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
  const accent = s === "modern" ? "bg-brand-600" : s === "executive" ? "bg-ink-900" : "bg-brand-900";
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
      <div className="mt-2 grid grid-cols-3 gap-2">
        {CV_STYLES.map((s) => (
          <label key={s} className={`cursor-pointer rounded-2xl p-2 ring-1 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500 ${value === s ? "bg-brand-50 ring-2 ring-brand-500" : "bg-ink-50 ring-ink-150 hover:bg-ink-75"}`}>
            <input type="radio" name="cv-style" value={s} checked={value === s} onChange={() => onChange(s)} className="sr-only" />
            <Thumb s={s} />
            <span className="mt-1.5 block text-center text-[0.8125rem] font-semibold text-ink-900">{CV_STYLE_INFO[s].label}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-ink-500">{CV_STYLE_INFO[value].note} All three read cleanly in applicant tracking systems.</p>
    </fieldset>
  );
}
