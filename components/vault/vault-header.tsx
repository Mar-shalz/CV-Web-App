import Link from "next/link";
import type { Vault } from "@/lib/vault/data";
import { LIMITS } from "@/lib/config";
import { DocumentUpload, Microphone2, AddCircle } from "@/components/icons";

export function VaultActions() {
  const cls = "lift flex min-h-14 items-center gap-3 rounded-2xl border border-ink-150 bg-white px-4 text-sm font-semibold text-ink-900 shadow-card";
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      <Link href="/vault/import" className={cls}>
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <DocumentUpload size={22} variant="bulk" />
        </span>
        Upload a CV
      </Link>
      <Link href="/vault/interview" className={cls}>
        <span className="grid size-10 place-items-center rounded-xl bg-proof-50 text-proof-700">
          <Microphone2 size={22} variant="bulk" />
        </span>
        Answer a few questions
      </Link>
      <Link href="/vault/new" className={cls}>
        <span className="grid size-10 place-items-center rounded-xl bg-ink-75 text-ink-700">
          <AddCircle size={22} variant="bulk" />
        </span>
        Add a role by hand
      </Link>
    </div>
  );
}

export function ReadinessMeter({ vault }: { vault: Vault }) {
  const target = LIMITS.onboarding.vault_ready_items;
  const shown = Math.min(vault.confirmedItems, target);
  return (
    <div className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-900">{vault.ready ? "Ready for strong CVs" : `${target - vault.confirmedItems} more confirmed achievements to go`}</p>
        <p className="text-sm tabular-nums text-ink-500">
          {vault.confirmedItems} confirmed{vault.totalItems > vault.confirmedItems ? ` of ${vault.totalItems}` : ""}
        </p>
      </div>
      <ol className="mt-3 flex gap-1.5" aria-label={`${vault.confirmedItems} of ${target} needed achievements confirmed`}>
        {Array.from({ length: target }, (_, i) => (
          <li key={i} className={`h-2 flex-1 rounded-full transition-colors duration-700 ${i < shown ? "bg-proof-600" : "bg-ink-150"}`} />
        ))}
      </ol>
    </div>
  );
}
