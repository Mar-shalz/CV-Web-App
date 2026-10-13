import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { signOut } from "@/app/(auth)/actions";
import { MARKETS } from "@/lib/config";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/shell/user-chip";
import { ArrowRight2, Lock1, Logout, ShieldTick, DocumentDownload, Mobile, Global, Crown1, Edit2 } from "@/components/icons";
import { DataSaverSwitch } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Settings" };

function Row({ href, icon, title, body }: { href?: string; icon: React.ReactNode; title: string; body: string }) {
  const inner = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink-75 text-ink-700">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-ink-900">{title}</span>
        <span className="block text-[0.8125rem] leading-5 text-ink-500">{body}</span>
      </span>
      {href ? (
        <ArrowRight2 size={18} className="nudge shrink-0 text-ink-400" />
      ) : (
        <span className="shrink-0 rounded-full bg-ink-75 px-2.5 py-1 text-xs font-medium text-ink-500">Coming soon</span>
      )}
    </>
  );
  const cls = "group flex min-h-[76px] items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors";
  return <li>{href ? <Link href={href} className={`${cls} hover:bg-ink-50`}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
}

export default async function SettingsPage() {
  const viewer = await requireReadyViewer();
  const stage = MARKETS.career_stages.find((s) => s.id === viewer.careerStage)?.label;
  const markets = viewer.targetMarkets.map((c) => MARKETS.countries.find((x) => x.code === c)?.label ?? c).join(", ");

  return (
    <div className="space-y-3">
      <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Settings</h1>

      <section className="flex animate-rise flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
        <Avatar name={viewer.fullName} size={64} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-ink-900">{viewer.fullName ?? "Add your name"}</p>
          <p className="truncate text-sm text-ink-600">{viewer.email}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">
            {stage ?? "Stage not set"}
            {markets ? ` · Applying in ${markets}` : ""}
          </p>
        </div>
        <ButtonLink href="/settings/profile" variant="secondary" size="sm" className="shrink-0">
          <Edit2 size={18} />
          Edit details
        </ButtonLink>
      </section>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <section aria-label="Your job search and plan" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-2 shadow-card">
          <ul>
            <Row href="/onboarding/setup" icon={<Global size={20} />} title="Where you're applying" body={markets || "Not set"} />
            <li>
              <DataSaverSwitch initial={viewer.lowDataMode} icon={<Mobile size={20} />} />
            </li>
            <Row href="/pass" icon={<Crown1 size={20} />} title="Pass and payments" body="Your pass, receipts and the refund rule." />
          </ul>
        </section>

        <section aria-label="Privacy and your data" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-2 shadow-card">
          <ul>
            <Row href="/settings/sensitive" icon={<Lock1 size={20} />} title="Sensitive details" body="Date of birth, gender and state of origin. Encrypted, and only asked for when a job needs them." />
            <Row href="/settings/consents" icon={<ShieldTick size={20} />} title="Your consents" body="See and change what you agreed to." />
            <Row href="/settings/data" icon={<DocumentDownload size={20} />} title="Download or delete my data" body="Get a copy of everything, or close your account for good." />
          </ul>
        </section>
      </div>

      <form action={signOut}>
        <Button type="submit" variant="danger" size="lg" className="w-full">
          <Logout size={20} />
          Sign out
        </Button>
      </form>
    </div>
  );
}
