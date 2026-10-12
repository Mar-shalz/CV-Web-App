// The only analytics events the app may send (Build pack section 10), plus the two
// landing page events from D-004. No names, emails, phone numbers, CV or job text.
export type AnalyticsEvents = {
  signup_completed: { method: "google" | "email" };
  consent_updated: { type: "terms" | "privacy" | "marketing" | "sensitive_details" | "question_bank"; granted: boolean };
  setup_completed: { career_stage: string; target_markets_count: number };
  waitlist_joined: { source: string };
  landing_price_clicked: { product: string };
};

export type EventName = keyof AnalyticsEvents;

const ALLOWED_KEYS: { [K in EventName]: (keyof AnalyticsEvents[K])[] } = {
  signup_completed: ["method"],
  consent_updated: ["type", "granted"],
  setup_completed: ["career_stage", "target_markets_count"],
  waitlist_joined: ["source"],
  landing_price_clicked: ["product"],
};

/** Drops any property not on the allow list, so personal data can't slip in. */
export function sanitize<E extends EventName>(event: E, props: AnalyticsEvents[E]): Partial<AnalyticsEvents[E]> {
  const out: Partial<AnalyticsEvents[E]> = {};
  for (const k of ALLOWED_KEYS[event]) {
    if (props[k] !== undefined) out[k] = props[k];
  }
  return out;
}
