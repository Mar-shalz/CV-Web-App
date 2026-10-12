import { APP } from "@/lib/config";

const naira = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/** ₦5,000 style, from kobo. */
export function formatNaira(kobo: number): string {
  return `₦${naira.format(Math.round(kobo / 100))}`;
}

/** 12 Oct 2026, always in Africa/Lagos time. */
export function formatDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP.timezone,
  })
    .format(d)
    .replace("Sept", "Sep"); // Newer ICU writes "Sept"; the pack's style is three letters.
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP.timezone }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function initials(name: string | null | undefined): string {
  if (!name) return "You";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "You";
}

export function firstName(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}
