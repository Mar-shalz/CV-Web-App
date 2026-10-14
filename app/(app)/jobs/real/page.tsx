import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { CaptureForm } from "@/components/flow/capture-form";
import { ArrowLeft, Building, Sms, Global, ShieldSearch, Danger } from "@/components/icons";

export const metadata: Metadata = { title: "Is This Job Real?" };

const CHECKS = [
  { icon: Building, title: "The company", body: "Does it exist, and how long has it been around?" },
  { icon: Sms, title: "The email and link", body: "Are they on the company's own website, or a Gmail address?" },
  { icon: Global, title: "Where it was posted", body: "Is the job on the company's careers page or its LinkedIn?" },
  { icon: Danger, title: "Warnings", body: "Fees, WhatsApp only interviews, and public scam reports." },
];

/** Just the scam check, without tailoring a CV (D-113). Free for everyone, always. */
export default async function CheckRealPage() {
  await requireReadyViewer();
  return (
    <div className="space-y-3">
      <Link href="/home" className="-ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-1.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-75 hover:text-ink-900">
        <ArrowLeft size={18} />
        Back to home
      </Link>
      <header className="animate-rise">
        <h1 className="flex items-center gap-2.5 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">
          <ShieldSearch size={30} variant="bulk" className="text-brand-600" />
          Is This Job Real?
        </h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">Paste the job, its link or a screenshot. We check the company and the post before you send your details. Free, always.</p>
      </header>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
          <CaptureForm purpose="real" />
        </section>
        <aside className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">What We Check</h2>
          <ul className="mt-4 space-y-4">
            {CHECKS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon size={22} variant="bulk" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{title}</span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-600">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
