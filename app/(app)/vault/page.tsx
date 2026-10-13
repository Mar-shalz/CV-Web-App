import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getVault } from "@/lib/vault/data";
import { RoleCard } from "@/components/vault/role-card";
import { ReadinessMeter, VaultActions } from "@/components/vault/vault-header";
import { ImportPanel } from "@/components/vault/import-panel";
import { Warning2, ArrowRight, ShieldTick } from "@/components/icons";

export const metadata: Metadata = { title: "My experience" };

const GROUPS = [
  { title: "Work and experience", kinds: ["job", "nysc_ppa", "internship_siwes", "volunteer", "project"] },
  { title: "Education", kinds: ["education"] },
  { title: "Certifications and licences", kinds: ["certification", "licence"] },
] as const;

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const viewer = await requireReadyViewer();
  const { preview } = await searchParams;
  const vault = await getVault(viewer);
  const empty = vault.roles.length === 0 || preview === "empty";

  if (empty) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <header className="animate-rise">
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Add your experience</h1>
          <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">
            Everything your CV is built from: your roles, what you did, and your own words. Start with your old CV, even a photo of the printout.
          </p>
        </header>
        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
          <ImportPanel />
        </section>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-center sm:gap-6">
          <Link href="/vault/interview" className="inline-flex min-h-12 items-center justify-center gap-1.5 font-semibold text-brand-700 hover:underline">
            No CV? Answer a few questions instead
            <ArrowRight size={16} />
          </Link>
          <Link href="/vault/new" className="inline-flex min-h-12 items-center justify-center gap-1.5 font-semibold text-ink-600 hover:underline">
            Add a role by hand
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger space-y-3">
      <header style={{ "--i": 0 } as CSSProperties} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">My experience</h1>
          <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">Every line on your CV comes from here. Only confirmed achievements are used.</p>
        </div>
      </header>

      <div style={{ "--i": 1 } as CSSProperties} className="grid gap-3">
        <VaultActions />
        <ReadinessMeter vault={vault} />
      </div>

      {vault.unchecked ? (
        <Link
          style={{ "--i": 2 } as CSSProperties}
          href="/vault/review"
          className="lift flex items-center gap-3 rounded-[var(--radius-card)] border border-care-100 bg-care-50 p-4 text-care-700"
        >
          <Warning2 size={24} variant="bulk" className="shrink-0" />
          <span className="flex-1 text-sm">
            <span className="font-semibold">{vault.unchecked} things to check.</span> Nothing is used on a CV until you confirm it.
          </span>
          <ArrowRight size={18} />
        </Link>
      ) : null}

      {GROUPS.map((g, gi) => {
        const roles = vault.roles.filter((r) => (g.kinds as readonly string[]).includes(r.kind));
        if (!roles.length) return null;
        return (
          <section key={g.title} style={{ "--i": 3 + gi } as CSSProperties} aria-labelledby={`g-${gi}`}>
            <h2 id={`g-${gi}`} className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
              {g.title}
            </h2>
            <div className="grid gap-3 2xl:grid-cols-2">
              {roles.map((r) => (
                <RoleCard key={r.id} role={r} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="flex items-center gap-2 text-[0.8125rem] text-ink-500">
        <ShieldTick size={18} className="shrink-0" />
        Private to you. Download or delete everything from Settings.
      </p>
    </div>
  );
}
