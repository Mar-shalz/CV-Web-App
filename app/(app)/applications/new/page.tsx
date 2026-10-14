import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { LogForm } from "@/components/applications/log-form";
import { ArrowLeft2 } from "@/components/icons";

export const metadata: Metadata = { title: "Add an Application" };

export default async function LogApplicationPage() {
  await requireReadyViewer();
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link href="/applications" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
        <ArrowLeft2 size={16} />
        Applications
      </Link>
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Add an Application You Already Sent</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">Made your CV somewhere else? Keep it here with the job, and we&apos;ll check in and help you prepare when they reply.</p>
      </header>
      <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
        <LogForm />
      </section>
    </div>
  );
}
