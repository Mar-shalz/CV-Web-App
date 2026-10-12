import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry-options";

// Server and edge error tracking. Every event passes through the personal data
// scrubber in lib/observability/scrub.ts before it leaves the server.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN));
  }
}

export const onRequestError = Sentry.captureRequestError;
