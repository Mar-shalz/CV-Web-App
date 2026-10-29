import { CLOSED, type ApplicationStatus } from "@/lib/rules/status-flow";

// The applications board's columns and moves (founder rounds 33 and 34, D-201, D-202).
// Pure, so it is unit tested: what a drag may do is decided here, never by the model.

/** "unsent" is the undo of "sent": back to the CV or Ready to Send. */
export type Drop = ApplicationStatus | "unsent";

export type Column = {
  id: string;
  title: string;
  statuses: ApplicationStatus[];
  drop: Drop | null;
  empty: string;
  /** Header colours: the solid part and its light partner. Full class names, for Tailwind. */
  solid: string;
  tint: string;
};

const NOT_SENT: ApplicationStatus[] = ["draft", "packed"];

/** Left to right as an application moves on. Each colour keeps white text at 4.5:1 or better. */
export const COLUMNS: Column[] = [
  { id: "not_sent", title: "Not sent yet", statuses: ["draft", "packed"], drop: "unsent", empty: "Tailored CVs you haven't sent show here.", solid: "bg-indigo-600", tint: "bg-indigo-100 text-indigo-700" },
  { id: "sent", title: "Sent", statuses: ["sent"], drop: "sent", empty: "Waiting to hear back.", solid: "bg-blue-600", tint: "bg-blue-100 text-blue-700" },
  { id: "assessment", title: "Test", statuses: ["assessment"], drop: "assessment", empty: "Invited to a test or assessment.", solid: "bg-violet-600", tint: "bg-violet-100 text-violet-700" },
  { id: "interview", title: "Interview", statuses: ["interview", "second_interview"], drop: "interview", empty: "Drop a job here when they invite you.", solid: "bg-teal-700", tint: "bg-teal-100 text-teal-800" },
  { id: "offer", title: "Offer", statuses: ["offer", "accepted"], drop: "offer", empty: "Your offers land here.", solid: "bg-green-700", tint: "bg-green-100 text-green-800" },
  { id: "no_reply", title: "No reply", statuses: ["no_response"], drop: "no_response", empty: "No word after 30 days. A late reply can still move it on.", solid: "bg-amber-700", tint: "bg-amber-100 text-amber-800" },
  { id: "closed", title: "Not selected", statuses: ["rejected", "withdrawn"], drop: "rejected", empty: "Closed applications.", solid: "bg-rose-600", tint: "bg-rose-100 text-rose-700" },
];

/**
 * Where a card may go (D-202): any other column, back or forward, skipping stages, except
 * out of Not selected. Back to "Not sent yet" only from a job that was sent.
 */
export function canDrop(card: { status: ApplicationStatus }, col: Column): boolean {
  if (!col.drop || CLOSED.includes(card.status) || col.statuses.includes(card.status)) return false;
  if (col.drop === "unsent") return !NOT_SENT.includes(card.status);
  return true;
}

/** A job not marked sent yet must be sent first: the board asks how before it moves on. */
export function needsSend(card: { status: ApplicationStatus }, col: Column): boolean {
  return NOT_SENT.includes(card.status) && col.drop !== "unsent";
}

/** They got as far as a test, an interview or an offer (the warm word after a no says so, D-203). */
export const reachedFar = (status: ApplicationStatus) => ["assessment", "interview", "second_interview", "offer", "accepted"].includes(status);
