// Application status flow, Build pack section 4. Deterministic, no model involved.
export const STATUSES = [
  "draft",
  "packed",
  "sent",
  "no_response",
  "rejected",
  "assessment",
  "interview",
  "second_interview",
  "offer",
  "accepted",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof STATUSES)[number];

const AFTER_SENT: ApplicationStatus[] = ["no_response", "rejected", "assessment", "interview", "offer", "withdrawn"];

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  // Sent another way (WhatsApp, a job site, by hand) straight from the CV, no pack needed (D-199).
  draft: ["packed", "sent"],
  packed: ["sent"],
  sent: AFTER_SENT,
  // A late employer reply can still move a silent application forward,
  // to the same places a sent application can go. See D-006.
  no_response: AFTER_SENT.filter((s) => s !== "no_response"),
  assessment: ["interview", "rejected", "withdrawn"],
  interview: ["second_interview", "offer", "rejected", "withdrawn"],
  second_interview: ["offer", "rejected", "withdrawn"],
  offer: ["accepted", "withdrawn"],
  rejected: [],
  accepted: [],
  withdrawn: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Closed applications: nothing moves them on, on the board or anywhere else. */
export const CLOSED: readonly ApplicationStatus[] = ["rejected", "withdrawn"];

/**
 * A correction on the applications board (founder round 34, D-202): the person moves a
 * job to the stage they know it's at, back or forward, skipping stages, because real
 * replies don't follow the flow. Anything but a closed application, and only to a
 * different stage. Going back to "not sent" is an undo of "sent" (lib/applications/status.ts).
 */
export function canCorrect(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return from !== to && !CLOSED.includes(from);
}

export function nextStatuses(from: ApplicationStatus): readonly ApplicationStatus[] {
  return TRANSITIONS[from];
}

/** Moving to interview opens Shortlist mode. */
export function opensShortlist(to: ApplicationStatus): boolean {
  return to === "interview";
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  packed: "Ready to send",
  sent: "Sent",
  no_response: "No reply",
  rejected: "Not selected",
  assessment: "Assessment",
  interview: "Invited",
  second_interview: "2nd interview",
  offer: "Offer",
  accepted: "Accepted",
  withdrawn: "Withdrawn",
};
