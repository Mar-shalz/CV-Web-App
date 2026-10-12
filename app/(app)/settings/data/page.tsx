import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ExportData, DeleteAccountForm } from "@/components/settings/settings-forms";
import { PRICES } from "@/lib/config";

export const metadata: Metadata = { title: "Your data" };

export default async function DataPage() {
  await requireReadyViewer();
  return (
    <SettingsShell title="Download or delete my data" intro="It's your data. Take a copy whenever you like, or close your account and we delete it.">
      <section aria-labelledby="export-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        <h2 id="export-title" className="text-[0.9375rem] font-semibold text-ink-900">
          Download a copy
        </h2>
        <p className="mb-4 mt-1 text-[0.8125rem] leading-5 text-ink-600">One file with your experience, jobs, CVs, applications, interview notes and payments.</p>
        <ExportData />
      </section>
      <section aria-labelledby="delete-title" className="rounded-[var(--radius-card)] border border-flag-100 bg-white p-5 shadow-card lg:p-6">
        <h2 id="delete-title" className="text-[0.9375rem] font-semibold text-flag-700">
          Delete my account
        </h2>
        <ul className="mb-4 mt-2 list-disc space-y-1 pl-5 text-[0.8125rem] leading-5 text-ink-700">
          <li>Your experience, CVs, applications, saved job posts and files are deleted straight away. This can&apos;t be undone.</li>
          <li>Download a copy first if you want to keep anything.</li>
          <li>An active pass ends with your account. If you&apos;re within {PRICES.refund_rule.within_days} days of paying, ask us about a refund before you delete.</li>
          <li>Paystack keeps its own payment records, as the law requires.</li>
        </ul>
        <DeleteAccountForm />
      </section>
    </SettingsShell>
  );
}
