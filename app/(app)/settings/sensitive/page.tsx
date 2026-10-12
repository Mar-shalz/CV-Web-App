import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { sensitiveSaved } from "@/lib/sensitive";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SensitiveList } from "@/components/settings/settings-forms";
import { Lock1 } from "@/components/icons";

export const metadata: Metadata = { title: "Sensitive details" };

export default async function SensitivePage() {
  const viewer = await requireReadyViewer();
  const saved = viewer.preview ? ["date_of_birth", "nysc_status"] : await sensitiveSaved(viewer.id);
  return (
    <SettingsShell title="Sensitive details" intro="Date of birth, gender, state of origin and NYSC dates. We ask for one only when a job's rules or CV format need it.">
      <section className="space-y-4 rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        <p className="flex items-start gap-2.5 text-[0.8125rem] leading-5 text-ink-600">
          <Lock1 size={18} variant="bulk" className="mt-0.5 shrink-0 text-brand-600" />
          Each detail is encrypted on its own, so our database only holds scrambled text. A CV includes one only when you say yes for that download.
        </p>
        <SensitiveList saved={saved} />
      </section>
    </SettingsShell>
  );
}
