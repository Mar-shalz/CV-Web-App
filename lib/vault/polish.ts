import "server-only";
import { runTask } from "@/lib/ai";
import { lintCopy } from "@/lib/copy-lint";

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1_000, k: 1_000, million: 1_000_000, m: 1_000_000, billion: 1_000_000_000 };

/** Every number in a text, from digits ("1,500", "2.5m", "20%") and from words ("fifteen", "two hundred thousand"). */
export function numbersIn(text: string): Set<number> {
  const out = new Set<number>();
  const lower = text.toLowerCase().replace(/-/g, " ");
  for (const m of lower.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|thousand|billion|hundred)?\b/g)) {
    const base = Number(m[1]!.replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    out.add(base);
    if (m[2]) out.add(base * (SCALES[m[2]] ?? 1));
  }
  // Number words, run by run: "two hundred and fifty thousand" is 250,000.
  let total = 0;
  let current = 0;
  let inRun = false;
  const flush = () => {
    if (inRun) out.add(total + current);
    total = 0;
    current = 0;
    inRun = false;
  };
  for (const word of lower.split(/[^a-z0-9.]+/)) {
    if (word in UNITS) {
      current += UNITS[word]!;
      inRun = true;
    } else if (word in TENS) {
      current += TENS[word]!;
      inRun = true;
    } else if (word === "hundred" && inRun) current = (current || 1) * 100;
    else if ((word === "thousand" || word === "million" || word === "billion") && inRun) {
      total += (current || 1) * SCALES[word]!;
      current = 0;
    } else if (word === "and" && inRun) continue;
    else flush();
  }
  flush();
  if (/\bhalf\b/.test(lower)) out.add(0.5);
  return out;
}

/** True when every number in the tidied line was said (as digits or words). */
export function addsNoNumbers(spoken: string, polished: string): boolean {
  const said = numbersIn(spoken);
  for (const n of numbersIn(polished)) {
    if (said.has(n)) continue;
    // "20 percent" said, "20%" written: same number. Small counting words like "one" are fine either way.
    if (n <= 1) continue;
    return false;
  }
  return true;
}

/**
 * The spoken achievement, tidied into a clear line (D-125). Falls back to what they said
 * when the model is unavailable, unsure, adds a number, or uses a banned phrase.
 */
export async function polishSpoken(spoken: string, role: string | null, userId: string | null): Promise<{ text: string; polished: boolean }> {
  const raw = spoken.trim();
  if (raw.split(/\s+/).length < 4) return { text: raw, polished: false };
  const res = await runTask("polish_achievement", { role, spoken: raw.slice(0, 2000) }, { userId: userId ?? undefined });
  if (!res.ok || res.data.unclear) return { text: raw, polished: false };
  const text = res.data.text.replace(/—/g, ", ").trim();
  if (!addsNoNumbers(raw, text) || lintCopy(text).some((i) => i.kind === "phrase")) return { text: raw, polished: false };
  return { text, polished: text !== raw };
}
