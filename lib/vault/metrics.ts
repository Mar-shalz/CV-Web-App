import type { Metric } from "./schema";

const APPROX = /\b(about|around|over|nearly|roughly|almost|approximately|up to|more than|over)\s*$/i;
const NUMBER = /(₦|NGN\s?|N(?=\d))?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m|million|thousand|%|percent)?(\+)?/gi;

const STOP = new Set(["a", "an", "the", "per", "in", "each", "every", "from", "for", "to", "at", "on", "with", "and", "by", "of"]);

function scale(n: number, suffix: string | undefined): number {
  switch ((suffix ?? "").toLowerCase()) {
    case "k":
    case "thousand":
      return n * 1_000;
    case "m":
    case "million":
      return n * 1_000_000;
    default:
      return n;
  }
}

/**
 * Pulls numbers out of a sentence the user wrote, with a short unit and an
 * "approximate" flag (about 15, around 200, 50+). Deterministic, so hand written
 * items carry metrics the fact lock can match.
 */
export function extractMetrics(text: string): Metric[] {
  const out: Metric[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const [whole, currency, digits, suffix, plus] = m;
    const index = m.index ?? 0;
    // Skip years (1990 to 2039) standing alone: dates are not metrics.
    if (!currency && !suffix && /^(19|20)\d{2}$/.test(digits)) continue;
    const value = scale(Number(digits.replace(/,/g, "")), suffix);
    if (!Number.isFinite(value)) continue;
    const before = text.slice(Math.max(0, index - 20), index);
    const words = text.slice(index + whole.length).trim().split(/\s+/);
    const stop = words.findIndex((w) => STOP.has(w.toLowerCase().replace(/[.,;:]+$/, "")));
    const after = words.slice(0, Math.min(3, stop === -1 ? 3 : stop)).join(" ").replace(/[.,;:]+$/, "");
    const unit = currency ? "naira" : suffix === "%" || suffix?.toLowerCase() === "percent" ? "percent" : after.slice(0, 40);
    out.push({ value, unit, approximate: APPROX.test(before) || Boolean(plus) });
  }
  return out.slice(0, 6);
}
