import { Badge, type Tone } from "./status";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/rules/status-flow";

// Rejected and no response are neutral, never red: no shame (PRD voice principle 5).
const TONES: Record<ApplicationStatus, Tone> = {
  draft: "neutral",
  packed: "neutral",
  sent: "brand",
  no_response: "neutral",
  rejected: "neutral",
  assessment: "brand",
  interview: "proof",
  second_interview: "proof",
  offer: "proof",
  accepted: "proof",
  withdrawn: "neutral",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
