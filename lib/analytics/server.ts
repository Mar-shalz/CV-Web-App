import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { sanitize, type AnalyticsEvents, type EventName } from "./events";

/**
 * Salted hash of a user id. Lets analytics and AI cost logs count per user without
 * holding the raw id or email. Same salt everywhere so the two can be joined.
 */
export function pseudonymousId(userId: string): string {
  const salt = process.env.ANALYTICS_SALT ?? "";
  return createHash("sha256").update(salt + userId).digest("hex").slice(0, 32);
}

/**
 * Server side capture to PostHog EU. The distinct id is a salted hash of the user id,
 * never the raw id or email. No-op when POSTHOG_KEY is not set.
 */
export async function track<E extends EventName>(event: E, props: AnalyticsEvents[E], userId?: string) {
  const key = process.env.POSTHOG_KEY;
  if (!key) return;
  const distinctId = userId ? pseudonymousId(userId) : "anonymous";
  const send = async () => {
    try {
      await fetch("https://eu.i.posthog.com/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties: { ...sanitize(event, props), $process_person_profile: false } }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Analytics must never break a user flow.
    }
  };
  // Sent after the response, so analytics never slows a screen down (D-150). Outside a
  // request (scripts, tests) it is sent straight away.
  try {
    after(send);
  } catch {
    await send();
  }
}
