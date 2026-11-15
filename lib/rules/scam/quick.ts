import { EMPTY_JOB } from "@/lib/jobs/schema";
import { layer1, type Signal } from "./layer1";

// The public quick check (founder round 50): Layer 1 over pasted words alone. No account,
// no AI and nothing saved, so it costs nothing to run for a visitor. It reads the post's
// own words only; the company, its website and where the job was posted need the full check.

export const QUICK_MIN = 80;
export const QUICK_MAX = 20_000;

const CHAT_LINK = /wa\.me|whatsapp|t\.me|telegram/i;

/** The warning signs in the words of a post. Never a verdict on the employer. */
export function textCheck(text: string): Signal[] {
  const t = text.slice(0, QUICK_MAX);
  const emails = [...new Set(t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [])].slice(0, 5);
  // A chat link is not an apply link: the "chat apps only" rule reads it from the words.
  const url = (t.match(/https?:\/\/[^\s<>"')]+/g) ?? []).find((u) => !CHAT_LINK.test(u)) ?? null;
  const job = { ...EMPTY_JOB, how_to_apply: { ...EMPTY_JOB.how_to_apply, email: emails[0] ?? null, url }, contacts: { emails, phones: [] } };
  return layer1(t, job).filter((s) => s.severity !== "info");
}
