"use server";

import { textCheck, QUICK_MIN, QUICK_MAX } from "@/lib/rules/scam/quick";
import { track } from "@/lib/analytics/server";

export type QuickSignal = { id: string; severity: "red" | "amber"; text: string; evidence: string | null };
export type QuickState = { error?: string; result?: { signals: QuickSignal[] } } | undefined;

/**
 * The public quick check (founder round 50): rules over the pasted words, nothing else.
 * No account, no AI call and nothing stored; analytics gets two counts and no text.
 */
export async function quickCheck(_prev: QuickState, formData: FormData): Promise<QuickState> {
  const text = String(formData.get("post") ?? "").trim();
  if (text.length < QUICK_MIN) return { error: "Paste the whole job ad. A few sentences are needed to check it." };
  if (text.length > QUICK_MAX) return { error: "That's too long to check here. Paste the job ad on its own." };
  const signals = textCheck(text) as QuickSignal[];
  await track("quick_check_done", { red_count: signals.filter((s) => s.severity === "red").length, amber_count: signals.filter((s) => s.severity === "amber").length });
  return { result: { signals } };
}
