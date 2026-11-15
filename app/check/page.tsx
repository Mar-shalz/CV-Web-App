import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { QuickCheck } from "@/components/landing/quick-check";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Check a Job Ad for Warning Signs",
  description: "Paste a job ad and see the warning signs in its words: requests for money, pressure to act fast, chat only contacts. Free, with no account.",
  alternates: { canonical: "/check" },
};

/**
 * The public quick check (founder round 50): the landing page's first action. It reads the
 * words of an ad with rules only, so a visitor needs no account and it costs nothing to run.
 * It says what it didn't check, and never that a job is safe.
 */
export default function QuickCheckPage() {
  return (
    <div className="min-h-dvh bg-[#f5f5f7] text-ink-900">
      <header className="lp-bar sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-5">
          <Link href="/" aria-label={`${APP_NAME} home`} className="rounded-xl">
            <Logo size={28} />
          </Link>
          <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-medium text-ink-700 hover:text-ink-900">
            Sign in
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[720px] px-5 pb-24 pt-12 sm:pt-16">
        <h1 className="font-display text-[2.25rem] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-[3rem]">Check a job ad for warning signs.</h1>
        <p className="mt-4 max-w-[38rem] text-[1.0625rem] leading-7 text-ink-600 sm:text-[1.1875rem] sm:leading-8">
          Paste the ad. This quick check reads its words for requests for money, pressure to act fast and other signs worth a closer look. No account needed.
        </p>
        <div className="mt-8">
          <QuickCheck />
        </div>
        <p className="mt-8 text-sm leading-6 text-ink-500">
          Findings to help you investigate. No check can guarantee that a job is genuine. Never pay to apply, and confirm the employer&apos;s official recruitment channels before you share documents.
        </p>
      </main>
    </div>
  );
}
