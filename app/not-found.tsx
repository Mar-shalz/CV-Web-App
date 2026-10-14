import Link from "next/link";
import { Mark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink-50 px-6 text-center">
      <div className="max-w-sm">
        <Mark size={44} />
        <h1 className="mt-6 font-display text-2xl font-bold tracking-[-0.02em]">We Couldn&apos;t Find That Page</h1>
        <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">The link may be old, or the page has moved.</p>
        <Link href="/home" className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
          Go to Home
        </Link>
      </div>
    </main>
  );
}
