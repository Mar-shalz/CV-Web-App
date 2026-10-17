import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { signOut } from "@/app/(auth)/actions";
import { MARKETS } from "@/lib/config";
import { Avatar } from "@/components/shell/user-chip";
import { ArrowRight2, Lock1, Logout, ShieldTick, DocumentDownload, Mobile, Global, Crown1, Edit2 } from "@/components/icons";
import { DataSaverSwitch } from "@/components/settings/settings-forms";
import { SubmitButton } from "@/components/auth/submit-button";
import { marketsLabel } from "@/lib/markets";
import { AccessCard } from "@/components/shell/access-card";
import { accessState } from "@/lib/entitlements";

export const metadata: Metadata = { title: "Settings" };

function Row({ href, icon, title, body, className }: { href?: string; icon: React.ReactNode; title: string; body: string; className?: string }) {
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
  return <li className={className}>{href ? <Link href={href} className={`${cls} hover:bg-ink-50`}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
}

export default async function SettingsPage() {
  const viewer = await requireReadyViewer();
  const stage = MARKETS.career_stages.find((s) => s.id === viewer.careerStage)?.label;
  const markets = marketsLabel(viewer.targetMarkets);
  const access = accessState({ trialStartedAt: viewer.trial.startedAt, trialEndsAt: viewer.trial.endsAt, trialCvsUsed: viewer.trial.cvsUsed, activePass: viewer.activePass });

  return (
    <div className="space-y-3">
      {/* Laptops and tablets: the extension sits beside the heading, on the other side. Phones: in the list below. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Settings</h1>
        <Link
          href="/extension"
          className="hidden min-h-12 items-center gap-2.5 rounded-2xl border border-ink-150 bg-white py-1.5 pl-1.5 pr-4 text-sm shadow-card transition-colors hover:border-brand-200 hover:bg-brand-50 lg:inline-flex"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Global size={20} variant="bulk" />
          </span>
          <span className="leading-tight">
            <span className="block font-semibold text-ink-900">Chrome extension</span>
            <span className="block text-xs text-ink-500">Send any job here in one click</span>
          </span>
        </Link>
      </div>

      <section className="relative flex animate-rise items-center gap-4 rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 pr-16 shadow-card sm:pr-5">
        {/* No avatar on phones: the name and details get the full width. */}
        <span className="hidden sm:block">
          <Avatar name={viewer.fullName} size={64} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-ink-900 [overflow-wrap:anywhere]">{viewer.fullName ?? "Add your name"}</p>
          <p className="text-sm text-ink-600 [overflow-wrap:anywhere]">{viewer.email}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">
            {stage ?? "Stage not set"}
            {markets ? ` · Applying in ${markets}` : ""}
          </p>
        </div>
        {/* Phones: an edit icon in the corner. Wider screens: a labelled button. */}
        <Link
          href="/settings/profile"
          className="absolute right-3 top-3 grid size-10 shrink-0 place-items-center rounded-lg border border-ink-150 bg-white text-ink-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 sm:static sm:inline-flex sm:size-auto sm:min-h-12 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm sm:font-semibold sm:text-ink-800"
        >
          <Edit2 size={18} />
          <span className="sr-only sm:not-sr-only">Edit details</span>
        </Link>
      </section>

      {/* Phones: the trial or pass card lives here, not on Home (founder, round 24). */}
      <div className="lg:hidden">
        <AccessCard state={access} />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <section aria-label="Your job search and plan" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-2 shadow-card">
          <ul>
            <Row href="/onboarding/setup" icon={<Global size={20} />} title="Where you're applying" body={markets || "Not set"} />
            <li>
              <DataSaverSwitch initial={viewer.lowDataMode} icon={<Mobile size={20} />} />
            </li>
            <Row href="/pass" icon={<Crown1 size={20} />} title="Pass and payments" body="Your pass, receipts and the refund rule." />
            <Row className="lg:hidden" href="/extension" icon={<Global size={20} />} title="Chrome extension" body="On a laptop or tablet: send any job you're looking at here in one click." />
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
        <SubmitButton variant="danger" size="lg" className="w-full" pendingLabel="Signing out">
          <Logout size={20} />
          Sign out
        </SubmitButton>
      </form>
    </div>
  );
}
