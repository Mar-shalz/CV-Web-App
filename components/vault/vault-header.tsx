import Link from "next/link";
import type { Vault } from "@/lib/vault/data";
import { LIMITS } from "@/lib/config";
import { DocumentUpload, Microphone2, AddCircle } from "@/components/icons";

const ACTIONS = [
  { href: "/experience/import", icon: DocumentUpload, tint: "bg-brand-50 text-brand-700", title: "Upload a CV", hint: "PDF, Word or a photo of it" },
  { href: "/experience/interview", icon: Microphone2, tint: "bg-proof-50 text-proof-700", title: "Answer a few questions", hint: "Talk or type. Tap the mic to speak" },
  { href: "/experience/new", icon: AddCircle, tint: "bg-ink-75 text-ink-700", title: "Add a role by hand", hint: "A job, SIWES, NYSC or your degree" },
] as const;

export function VaultActions() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {ACTIONS.map(({ href, icon: Icon, tint, title, hint }) => (
        <Link key={href} href={href} className="lift group flex min-h-[5.5rem] items-center gap-3.5 rounded-2xl border border-ink-150 bg-white px-4 py-4 shadow-card sm:min-h-28 sm:flex-col sm:items-start sm:justify-between sm:gap-3 sm:px-5">
          <span className={`grid size-12 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tint}`}>
            <Icon size={24} variant="bulk" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.9375rem] font-semibold text-ink-900">{title}</span>
            <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-500">{hint}</span>
          </span>
        </Link>
      ))}
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
          <li key={i} className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink-150">
            {i < shown ? <span className="meter-fill absolute inset-0 rounded-full bg-proof-600" style={{ ["--i" as string]: i }} /> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
