import Link from "next/link";
import { Briefcase, ArrowRight } from "@/components/icons";
import { LIMITS } from "@/lib/config";

export function VaultCard({ confirmed }: { confirmed: number }) {
  const target = LIMITS.onboarding.vault_ready_items;
  const ready = confirmed >= target;
  const shown = Math.min(confirmed, target);
  return (
    <section aria-labelledby="vault-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-proof-50 text-proof-700">
          <Briefcase size={24} variant="bulk" />
        </span>
        <div>
          <h2 id="vault-title" className="text-lg font-semibold text-ink-900">
            My experience
          </h2>
          <p className="text-[0.8125rem] text-ink-500">{ready ? "Ready for strong CVs" : `Add ${target - confirmed} more to get started`}</p>
        </div>
      </div>
      <ol className="mt-4 flex gap-1.5" aria-label={`${confirmed} of ${target} experience items confirmed`}>
        {Array.from({ length: target }, (_, i) => (
          <li key={i} className={`h-2 flex-1 rounded-full transition-colors duration-500 ${i < shown ? "bg-proof-600" : "bg-ink-150"}`} />
        ))}
      </ol>
      <p className="mt-3 text-[0.8125rem] leading-5 text-ink-600">
        <span className="font-semibold text-ink-900">{confirmed}</span> confirmed {confirmed === 1 ? "item" : "items"}. Every line on your CV comes from here, so
        nothing is made up.
      </p>
      <Link href="/vault" className="mt-3 inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        {ready ? "Add a recent win" : "Add your experience"}
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
