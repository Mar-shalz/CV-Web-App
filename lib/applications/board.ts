import { canTransition, type ApplicationStatus } from "@/lib/rules/status-flow";

// The applications board's columns and moves (founder round 33, D-201). Pure, so it is
// unit tested: what a drag may do comes from the status flow, never the model.

export type Column = { id: string; title: string; statuses: ApplicationStatus[]; drop: ApplicationStatus | null; empty: string };

/** The board's columns (founder round 33, D-201), left to right as an application moves on. */
export const COLUMNS: Column[] = [
  { id: "not_sent", title: "Not sent yet", statuses: ["draft", "packed"], drop: null, empty: "Tailored CVs you haven't sent show here." },
  { id: "sent", title: "Sent", statuses: ["sent"], drop: "sent", empty: "Waiting to hear back." },
  { id: "assessment", title: "Test", statuses: ["assessment"], drop: "assessment", empty: "Invited to a test or assessment." },
  { id: "interview", title: "Interview", statuses: ["interview", "second_interview"], drop: "interview", empty: "Drop a job here to start interview prep." },
  { id: "offer", title: "Offer", statuses: ["offer", "accepted"], drop: "offer", empty: "Here's hoping." },
  { id: "no_reply", title: "No reply", statuses: ["no_response"], drop: "no_response", empty: "No word after 30 days. A late reply can still move it on." },
  { id: "closed", title: "Not selected", statuses: ["rejected", "withdrawn"], drop: "rejected", empty: "Closed applications." },
];

/** Where a card may go: deterministic, from the status flow, never the model. */
export function canDrop(card: { status: ApplicationStatus }, col: Column): boolean {
  return Boolean(col.drop && !col.statuses.includes(card.status) && canTransition(card.status, col.drop));
}

