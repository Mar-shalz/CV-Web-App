import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getVault } from "@/lib/vault/data";
import { RoleCard } from "@/components/vault/role-card";
import { ReadinessMeter, VaultActions } from "@/components/vault/vault-header";
import lazy from "next/dynamic";
import { DownloadCv } from "@/components/vault/download-cv";
import { RoleColumns } from "@/components/vault/role-columns";
import { Warning2, ArrowRight, ShieldTick, ArrowDown2 } from "@/components/icons";

export const metadata: Metadata = { title: "My Experience" };

// Only the empty state uses the upload panel, so its code loads only then.
const ImportPanel = lazy(() => import("@/components/vault/import-panel").then((m) => m.ImportPanel));
// Writing a CV from the whole experience can take up to a minute.
export const maxDuration = 120;

const GROUPS = [
  { title: "Work and Experience", kinds: ["job", "nysc_ppa", "internship_siwes", "volunteer", "project"] },
  { title: "Education", kinds: ["education"] },
  { title: "Certifications and Licences", kinds: ["certification", "licence"] },
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
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Add your Experience</h1>
          <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">
            Everything your CV is built from: your roles, what you did, and your own words. Start with your old CV, even a photo of the printout.
          </p>
        </header>
        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-7">
          <ImportPanel />
        </section>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-center sm:gap-6">
          <Link href="/experience/interview" className="inline-flex min-h-12 items-center justify-center gap-1.5 font-semibold text-brand-700 hover:underline">
            No CV? Answer a few questions instead
            <ArrowRight size={16} />
          </Link>
          <Link href="/experience/new" className="inline-flex min-h-12 items-center justify-center gap-1.5 font-semibold text-ink-600 hover:underline">
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
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">My Experience</h1>
          <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">Every line on your CV comes from here. Only confirmed achievements are used.</p>
        </div>
        <DownloadCv ready={vault.confirmedItems > 0} />
      </header>

      <div style={{ "--i": 1 } as CSSProperties} className="grid gap-3">
        <VaultActions />
        <ReadinessMeter vault={vault} />
      </div>

      {vault.unchecked ? (
        <Link
          style={{ "--i": 2 } as CSSProperties}
          href="/experience/review"
          className="lift flex items-center gap-3 rounded-[var(--radius-card)] border border-care-100 bg-care-50 p-4 text-care-700"
        >
          <Warning2 size={24} variant="bulk" className="shrink-0" />
          <span className="flex-1 text-sm">
            <span className="font-semibold">{vault.unchecked} things to check.</span> Nothing is used on a CV until you confirm it.
          </span>
          <ArrowRight size={18} />
        </Link>
      ) : null}

      {/* Each section folds on its own (D-119). On wide screens the two columns move independently (D-131). */}
      {GROUPS.map((g, gi) => {
        const roles = vault.roles.filter((r) => (g.kinds as readonly string[]).includes(r.kind));
        if (!roles.length) return null;
        return (
          <details key={g.title} open style={{ "--i": 3 + gi } as CSSProperties} className="group/section">
            {/* A clear, full width header: the whole bar opens and closes the section, and it says which it will do. */}
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-card ring-1 ring-ink-150 transition-colors hover:bg-ink-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-500 group-open/section:rounded-b-xl [&::-webkit-details-marker]:hidden">
              <h2 className="text-base font-semibold text-ink-900">{g.title}</h2>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-brand-700">{roles.length}</span>
              <span className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink-75 px-3 text-sm font-semibold text-ink-700">
                <span className="group-open/section:hidden">Show</span>
                <span className="hidden group-open/section:inline">Hide</span>
                <ArrowDown2 size={16} className="transition-transform duration-200 group-open/section:rotate-180" />
              </span>
            </summary>
            <div className="mt-3">
            <RoleColumns>
              {roles.map((r) => (
                <RoleCard key={r.id} role={r} />
              ))}
            </RoleColumns>
            </div>
          </details>
        );
      })}

      <p className="flex items-center gap-2 text-[0.8125rem] text-ink-500">
        <ShieldTick size={18} className="shrink-0" />
        Private to you. Download or delete everything from Settings.
      </p>
    </div>
  );
}
