import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/brand/logo";
import { CloudCross } from "@/components/icons";

export const metadata: Metadata = { title: "You're offline" };

export default function OfflinePage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink-50 px-6 text-center">
      <div className="max-w-sm">
        <Mark size={44} />
        <span className="mx-auto mt-8 grid size-14 place-items-center rounded-2xl bg-white text-ink-700 shadow-card">
          <CloudCross size={28} variant="bulk" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em]">You&apos;re offline</h1>
        <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
          Applications you&apos;ve opened on this phone still work offline, with the job post and the CV you sent.
        </p>
        <Link href="/applications" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
          Open my applications
        </Link>
      </div>
    </main>
  );
}
