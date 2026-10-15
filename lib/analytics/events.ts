// The only analytics events the app may send (Build pack section 10), plus the two
// landing page events from D-004. No names, emails, phone numbers, CV or job text.
export type AnalyticsEvents = {
  signup_completed: { method: "google" | "email" };
  consent_updated: { type: "terms" | "privacy" | "marketing" | "sensitive_details" | "question_bank"; granted: boolean };
  setup_completed: { career_stage: string; target_markets_count: number };
  waitlist_joined: { source: string };
  landing_price_clicked: { product: string };
  vault_import_completed: { source_type: string; roles_count: number; items_count: number };
  interview_answer_submitted: { mode: "voice" | "text"; duration_s: number };
  vault_ready: { items_confirmed: number };
  job_captured: { source_type: string };
  job_parse_failed: { source_type: string; reason: string };
  destination_detected: { country: string; confidence_band: "high" | "ask" | "low"; changed_by_user: boolean };
  country_requested: { country: string };
  eligibility_checked: { overall: string; failed_rule_types: string };
  legitimacy_checked: { state: string; red_count: number; amber_count: number; cached: boolean };
  verdict_shown: { verdict: string };
  verdict_overridden: { verdict: string };
  cv_generated: { format: string; bullets_changed: number };
  fact_lock_violation: { type: string; prompt_version: string };
  claim_review_completed: { confirmed: number; edited: number; reverted: number };
  cv_exported: { format: string; file_type: "pdf" | "docx"; style?: string };
  check_shared: Record<string, never>;
  check_share_opened: { state: string };
  cv_design_requested: { reason: string };
  pack_opened: { channel: string };
  application_sent: { channel: string };
  checkin_shown: { applications_count: number };
  outcome_logged: { to_status: string; source: string; days_since_sent: number };
  shortlist_opened: { days_until_interview: number };
  drill_answered: { mode: "voice" | "text" };
  debrief_submitted: { mode: "voice" | "text" };
  paywall_shown: { trigger: string };
  payment_started: { product: string; price: number };
  payment_succeeded: { product: string; channel: string };
  payment_failed: { reason: string };
  trial_started: { trigger: string };
  trial_ended: { converted: boolean; cvs_used: number };
  flag_shown: { type: string };
  flag_resolved: { type: string; action: "fixed" | "removed" | "kept" };
  cv_downloaded_with_flags: { open_flags_count: number };
  survey_answered: { survey: "verdict_helpful" | "send_as_is" | "applied_anyway"; answer: string };
  transcript_corrected: { share_of_words_changed_band: string };
};

export type EventName = keyof AnalyticsEvents;

const ALLOWED_KEYS: { [K in EventName]: (keyof AnalyticsEvents[K])[] } = {
  signup_completed: ["method"],
  consent_updated: ["type", "granted"],
  setup_completed: ["career_stage", "target_markets_count"],
  waitlist_joined: ["source"],
  landing_price_clicked: ["product"],
  vault_import_completed: ["source_type", "roles_count", "items_count"],
  interview_answer_submitted: ["mode", "duration_s"],
  vault_ready: ["items_confirmed"],
  job_captured: ["source_type"],
  job_parse_failed: ["source_type", "reason"],
  destination_detected: ["country", "confidence_band", "changed_by_user"],
  country_requested: ["country"],
  eligibility_checked: ["overall", "failed_rule_types"],
  legitimacy_checked: ["state", "red_count", "amber_count", "cached"],
  verdict_shown: ["verdict"],
  verdict_overridden: ["verdict"],
  cv_generated: ["format", "bullets_changed"],
  fact_lock_violation: ["type", "prompt_version"],
  claim_review_completed: ["confirmed", "edited", "reverted"],
  cv_exported: ["format", "file_type", "style"],
  check_shared: [],
  check_share_opened: ["state"],
  cv_design_requested: ["reason"],
  pack_opened: ["channel"],
  application_sent: ["channel"],
  checkin_shown: ["applications_count"],
  outcome_logged: ["to_status", "source", "days_since_sent"],
  shortlist_opened: ["days_until_interview"],
  drill_answered: ["mode"],
  debrief_submitted: ["mode"],
  paywall_shown: ["trigger"],
  payment_started: ["product", "price"],
  payment_succeeded: ["product", "channel"],
  payment_failed: ["reason"],
  trial_started: ["trigger"],
  trial_ended: ["converted", "cvs_used"],
  flag_shown: ["type"],
  flag_resolved: ["type", "action"],
  cv_downloaded_with_flags: ["open_flags_count"],
  survey_answered: ["survey", "answer"],
  transcript_corrected: ["share_of_words_changed_band"],
};

/** Drops any property not on the allow list, so personal data can't slip in. */
export function sanitize<E extends EventName>(event: E, props: AnalyticsEvents[E]): Partial<AnalyticsEvents[E]> {
  const out: Partial<AnalyticsEvents[E]> = {};
  for (const k of ALLOWED_KEYS[event]) {
    if (props[k] !== undefined) out[k] = props[k];
  }
  return out;
}
