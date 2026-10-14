import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getVault } from "@/lib/vault/data";
import { RoleCard } from "@/components/vault/role-card";
import { ButtonLink } from "@/components/ui/button";
import { Lock1, TickCircle, ArrowRight } from "@/components/icons";

export const metadata: Metadata = { title: "Check What We Found" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ sensitive?: string }> }) {
  const viewer = await requireReadyViewer();
  const { sensitive } = await searchParams;
  const vault = await getVault(viewer);
  // Every role stays on the page, in the same order, so confirming one never moves the
  // rest (D-103). The list only ends when nothing is left to check.
  const toCheck = vault.unchecked ? vault.roles : [];
  const totalChecks = vault.roles.length + vault.totalItems;
  const done = totalChecks - vault.unchecked;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Check What We Found</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">Read each one. Confirm what&apos;s right, fix what isn&apos;t. Nothing goes on a CV until you confirm it.</p>
        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-ink-700">
              {done} of {totalChecks} checked
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-150" role="progressbar" aria-valuemin={0} aria-valuemax={totalChecks} aria-valuenow={done} aria-label="Checked so far">
            <div className="h-full rounded-full bg-proof-600 transition-[width] duration-700" style={{ width: `${totalChecks ? (done / totalChecks) * 100 : 0}%` }} />
          </div>
        </div>
      </header>

      {sensitive ? (
        <p className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-4 text-sm leading-5 text-brand-800">
          <Lock1 size={20} className="mt-px shrink-0" />
          Your old CV had personal details like date of birth or state of origin. We left them out. If a job ever needs one, we&apos;ll ask you first.
        </p>
      ) : null}

      {toCheck.length ? (
        <div className="space-y-3">
          {toCheck.map((r) => (
            <RoleCard key={r.id} role={r} mode="review" />
          ))}
        </div>
      ) : (
        <section className="animate-pop rounded-[var(--radius-panel)] border border-proof-100 bg-gradient-to-b from-proof-50 to-white p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-proof-600 text-white shadow-raised">
            <TickCircle size={36} variant="bulk" />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-ink-900">All Checked</h2>
          <p className="mt-1 text-[0.9375rem] text-ink-600">
            {vault.confirmedItems} confirmed achievements ready to use.{vault.ready ? "" : " A few more will make your CVs stronger."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink href="/jobs/new">
              Tailor my CV to a job
              <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="/experience/interview" variant="secondary">
              Add more by answering questions
            </ButtonLink>
          </div>
        </section>
      )}
    </div>
  );
}
