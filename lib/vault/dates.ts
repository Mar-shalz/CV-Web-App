const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-03" or "2024-03-01" to "Mar 2024". */
export function monthLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m] = value.split("-");
  const i = Number(m) - 1;
  if (!y || Number.isNaN(i) || i < 0 || i > 11) return null;
  return `${MONTHS[i]} ${y}`;
}

/** The CV writing standard's one date style: "Jan 2024 to Dec 2025", or "to date". */
export function rangeLabel(start: string | null, end: string | null, current: boolean): string {
  const s = monthLabel(start);
  const e = current ? "date" : monthLabel(end);
  if (!s && !e) return "Dates not added";
  if (!s) return `Until ${e}`;
  return `${s} to ${e ?? "?"}`;
}

/** YYYY-MM to a Postgres date (first of the month), or null. */
export const toDate = (ym: string | null | undefined) => (ym && /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : null);
/** Postgres date to YYYY-MM. */
export const toYearMonth = (d: string | null | undefined) => (d ? d.slice(0, 7) : null);
