import {
  BrowserClient,
  browserApiErrorsIntegration,
  dedupeIntegration,
  defaultStackParser,
  getCurrentScope,
  globalHandlersIntegration,
  httpContextIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
} from "@sentry/browser";
import { sentryOptions } from "@/lib/observability/sentry-options";

// Browser error tracking. A bare client with four integrations instead of the full
// Next.js SDK keeps Sentry to a few KB of the 300KB first load budget: no tracing,
// replay, feedback widget or breadcrumbs (console and click breadcrumbs can hold
// what the user typed). See D-016.
const options = sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN);

if (options.enabled) {
  const client = new BrowserClient({
    ...options,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [
      globalHandlersIntegration(),
      browserApiErrorsIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
    ],
  });
  getCurrentScope().setClient(client);
  client.init();
}
