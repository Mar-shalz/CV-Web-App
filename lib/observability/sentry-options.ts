// Sentry options shared by the browser, server and edge runtimes. No DSN means Sentry
// stays off, which is the default for local development and preview mode. See D-016.
import type { BrowserOptions } from "@sentry/browser";
import { beforeSend, scrubBreadcrumb, scrubEvent } from "./scrub";

export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    // Collect nothing about people or payloads at source. beforeSend scrubs again in
    // case an SDK path ignores these settings.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["content-type", "accept", "user-agent"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    // Errors only. Tracing costs data on the user's bundle and adds spans we don't need yet.
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeSend,
    beforeSendTransaction: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  } satisfies BrowserOptions;
}
