import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { ImportPanel } from "@/components/vault/import-panel";
import { getVault } from "@/lib/vault/data";

export const metadata: Metadata = { title: "Upload your CV" };

export default async function ImportPage() {
  const viewer = await requireReadyViewer();
  // A second CV asks whether to replace what's saved or add to it (D-184).
  const vault = await getVault(viewer);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Upload your CV</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">Got an old CV? Add it here, even a photo of the printout. We pull out what&apos;s useful, and you check it.</p>
      </header>
      <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
        <ImportPanel savedRoles={vault.roles.length} />
      </section>
    </div>
  );
}
