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
  draft: ["packed"],
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
