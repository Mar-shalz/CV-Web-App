"use client";

import { useState } from "react";
import { inputClass } from "./field";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function years(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = to; y >= from; y--) out.push(y);
  return out;
}

/**
 * Month and year as two plain dropdowns. Much quicker than a calendar for "when did you
 * start", which is often years back. Submits one hidden "YYYY-MM" value (or empty).
 */
export function MonthYearField({ id, name, label, defaultValue, disabled, minYear = 1970, maxYear = new Date().getFullYear() + 2, hint }: { id: string; name: string; label: string; defaultValue?: string | null; disabled?: boolean; minYear?: number; maxYear?: number; hint?: string }) {
  const [y0, m0] = (defaultValue ?? "").split("-");
  const [month, setMonth] = useState(m0 ?? "");
  const [year, setYear] = useState(y0 ?? "");
  const value = month && year ? `${year}-${month}` : "";
  return (
    <fieldset disabled={disabled} className="space-y-1.5 disabled:opacity-50">
      <legend className="mb-1.5 block text-sm font-semibold text-ink-900">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <label htmlFor={`${id}-m`} className="sr-only">
          {label}: month
        </label>
        <select id={`${id}-m`} value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-y`} className="sr-only">
          {label}: year
        </label>
        <select id={`${id}-y`} value={year} onChange={(e) => setYear(e.target.value)} className={inputClass}>
          <option value="">Year</option>
          {years(minYear, maxYear).map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name={name} value={disabled ? "" : value} />
      {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </fieldset>
  );
}

/** Day, month and year as dropdowns, for a date of birth. Submits one "YYYY-MM-DD" value. */
export function DayMonthYearField({ id, name, label, minYear = 1940, maxYear = new Date().getFullYear() - 14, hint }: { id: string; name: string; label: string; minYear?: number; maxYear?: number; hint?: string }) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const daysIn = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const safeDay = day && Number(day) > daysIn ? String(daysIn).padStart(2, "0") : day;
  const value = safeDay && month && year ? `${year}-${month}-${safeDay}` : "";
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 block text-sm font-semibold text-ink-900">{label}</legend>
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <label htmlFor={`${id}-d`} className="sr-only">
          Day
        </label>
        <select id={`${id}-d`} value={safeDay} onChange={(e) => setDay(e.target.value)} className={inputClass}>
          <option value="">Day</option>
          {Array.from({ length: daysIn }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
            <option key={d} value={d}>
              {Number(d)}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-m`} className="sr-only">
          Month
        </label>
        <select id={`${id}-m`} value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-y`} className="sr-only">
          Year
        </label>
        <select id={`${id}-y`} value={year} onChange={(e) => setYear(e.target.value)} className={inputClass}>
          <option value="">Year</option>
          {years(minYear, maxYear).map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name={name} value={value} />
      {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </fieldset>
  );
}
