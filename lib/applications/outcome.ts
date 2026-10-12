import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { runTask } from "@/lib/ai";
import { quoteIsFrom } from "@/lib/vault/quote";
import type { ApplicationStatus } from "@/lib/rules/status-flow";
import { guessSource, targetStatus } from "./outcome-rules";
import type { ApplicationView } from "./data";
import type { OutcomeSource } from "./status";

export type InviteDetails = { date: string | null; time: string | null; placeOrLink: string | null; format: "in_person" | "video" | "phone" | "test" | "unknown" };

export type OutcomeSuggestion =
  | {
      kind: "suggest";
      to: ApplicationStatus;
      /** The sentence from their message, only when code found it word for word. */
      evidence: string | null;
      confident: boolean;
      otherApplication: boolean;
      asksForPayment: boolean;
      invite: InviteDetails | null;
      source: OutcomeSource;
    }
  | { kind: "no_change"; evidence: string | null; asksForPayment: boolean }
  | { kind: "unclear" }
  | { kind: "manual" };

/** Paste to classify (Build pack screen 18 and PRD F9). The model suggests; the person confirms. */
export async function readEmployerMessage(viewer: Viewer, app: ApplicationView, message: string): Promise<OutcomeSuggestion> {
  if (viewer.preview) {
    return {
      kind: "suggest",
      to: targetStatus(app.status, "interview") ?? "interview",
      evidence: quoteIsFrom("You have been shortlisted for an interview", message) ? "You have been shortlisted for an interview" : null,
      confident: true,
      otherApplication: false,
      asksForPayment: /pay|fee|₦|naira/i.test(message),
      invite: { date: null, time: null, placeOrLink: null, format: "unknown" },
      source: guessSource(message),
    };
  }
  const res = await runTask(
    "classify_outcome",
    { message, application: { title: app.title, employer: app.employer, sent_on: app.sentAt?.slice(0, 10) ?? null } },
    { userId: viewer.id },
  );
  if (!res.ok) return { kind: "manual" };
  const d = res.data;
  const evidence = d.evidence && quoteIsFrom(d.evidence, message) ? d.evidence : null;
  if (d.status === "unclear") return { kind: "unclear" };
  if (d.status === "no_change") return { kind: "no_change", evidence, asksForPayment: d.asks_for_payment };
  const to = targetStatus(app.status, d.status);
  if (!to) return { kind: "unclear" };
  const isInvite = to === "interview" || to === "second_interview" || to === "assessment";
  return {
    kind: "suggest",
    to,
    evidence,
    confident: d.confidence >= 0.7 && evidence !== null,
    otherApplication: d.about_this_application === "no",
    asksForPayment: d.asks_for_payment,
    invite: isInvite ? { date: d.interview_date, time: d.interview_time, placeOrLink: d.place_or_link, format: d.format } : null,
    source: guessSource(message),
  };
}
