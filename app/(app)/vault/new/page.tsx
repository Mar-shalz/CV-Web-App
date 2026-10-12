import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RoleFormPage } from "@/components/vault/role-form-page";

export const metadata: Metadata = { title: "Add a role" };

export default async function NewRolePage() {
  await requireReadyViewer();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Add a role</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">A job, SIWES, NYSC, a campus role, a project, a degree or a certificate. Then add what you did there.</p>
      </header>
      <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
        <RoleFormPage />
      </section>
    </div>
  );
}
