"use client";

import { captureException } from "@sentry/browser";
import { useEffect } from "react";
import "./globals.css";

// Last resort error screen. React catches render errors before they reach the window,
// so this is where they get reported (scrubbed, see lib/observability/scrub.ts).
// No Figma frame yet: plain layout with the design tokens, logged as unstyled (D-016).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="en-NG">
      <body className="min-h-full">
        <main id="main" className="grid min-h-dvh place-items-center bg-ink-50 px-6 text-center">
          <div className="max-w-sm">
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">Something went wrong</h1>
            <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
              Try again. If it keeps happening, come back in a few minutes.
            </p>
            <button
              type="button"
              onClick={() => retry()}
              className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
