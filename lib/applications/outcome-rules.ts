import { canTransition, type ApplicationStatus } from "@/lib/rules/status-flow";
export type OutcomeSource = "tap" | "forwarded_email" | "pasted_sms" | "auto_30d";

// Pure rules behind paste to classify. The model reads the message; these decide what
// that reading may change.

/** Emails are long and formal; SMS are short. Only used to label the outcome event. */
export function guessSource(text: string): OutcomeSource {
  return text.length > 320 || /\b(dear|regards|sincerely|subject:)\b/i.test(text) ? "forwarded_email" : "pasted_sms";
}

/** Maps the model's reading onto this application's own status flow. */
export function targetStatus(current: ApplicationStatus, read: "interview" | "assessment" | "rejected" | "offer"): ApplicationStatus | null {
  const wanted: ApplicationStatus = read === "interview" && (current === "interview" || current === "second_interview") ? "second_interview" : read;
  return canTransition(current, wanted) ? wanted : null;
}
