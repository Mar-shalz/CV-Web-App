import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getHomeData } from "@/lib/home-data";
import { accessState } from "@/lib/entitlements";
import { firstName, formatDate, greeting } from "@/lib/format";
import { LIMITS } from "@/lib/config";
import { StatCard } from "@/components/home/stat-card";
import { CheckInCard } from "@/components/home/check-in-card";
import { TailorHero } from "@/components/home/tailor-hero";
import { RecentApplications } from "@/components/home/recent-applications";
import { VaultCard } from "@/components/home/vault-card";
import { GettingStarted } from "@/components/home/getting-started";
import { AccessCard } from "@/components/shell/access-card";
import { Send2, TickCircle, Clock, Briefcase, ShieldTick } from "@/components/icons";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const viewer = await requireReadyViewer();
  const { preview } = await searchParams;
  const data = await getHomeData(viewer, { previewEmpty: preview === "new" });
  const access = accessState({
    trialStartedAt: viewer.trial.startedAt,
    trialEndsAt: viewer.trial.endsAt,
    trialCvsUsed: viewer.trial.cvsUsed,
    activePass: viewer.activePass,
  });

  const isNew = data.recent.length === 0;
  const vaultReady = data.stats.vaultConfirmed >= LIMITS.onboarding.vault_ready_items;
  const name = firstName(viewer.fullName);

  return (
    <div className="stagger space-y-4">
      <header style={{ "--i": 0 } as CSSProperties}>
        <p className="text-sm text-ink-500">{formatDate(new Date())}</p>
        <h1 className="mt-0.5 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-[0.9375rem] text-ink-500">{isNew ? "Let's set you up to apply with proof." : "Here's where your job hunt stands."}</p>
      </header>

      {isNew ? (
        <div style={{ "--i": 1 } as CSSProperties}>
          <GettingStarted doneUpTo={vaultReady ? 1 : 0} />
        </div>
      ) : (
        <ul style={{ "--i": 1 } as CSSProperties} className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Your numbers">
          <li>
            <StatCard label="Applications sent" value={data.stats.sent} icon={<Send2 size={22} variant="bulk" />} tint="brand" hint="Quality over quantity" />
          </li>
          <li>
            <StatCard label="Interview invites" value={data.stats.invites} icon={<TickCircle size={22} variant="bulk" />} tint="proof" hint="From employers who replied" />
          </li>
          <li>
            <StatCard label="Waiting to hear back" value={data.stats.awaiting} icon={<Clock size={22} variant="bulk" />} tint="care" hint="Sent in the last 30 days" />
          </li>
          <li>
            <StatCard label="Experience items" value={data.stats.vaultConfirmed} icon={<Briefcase size={22} variant="bulk" />} tint="sky" hint="Confirmed by you" />
          </li>
        </ul>
      )}

      {data.checkIns.length ? (
        <div style={{ "--i": 2 } as CSSProperties}>
          <CheckInCard items={data.checkIns} />
        </div>
      ) : null}

      <div style={{ "--i": 3 } as CSSProperties}>
        <TailorHero trialReady={access.kind === "trial_ready"} />
      </div>

      <div
        style={{ "--i": 4 } as CSSProperties}
        className={isNew ? "grid gap-4 md:grid-cols-2" : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"}
      >
        {isNew ? null : (
          <div className="min-w-0">
            <RecentApplications items={data.recent} />
          </div>
        )}
        <div className={isNew ? "contents" : "space-y-4"}>
          <div className="lg:hidden">
            <AccessCard state={access} />
          </div>
          <VaultCard confirmed={data.stats.vaultConfirmed} />
          <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-900">
              <ShieldTick size={20} variant="bulk" className="text-proof-600" />
              Our promise to you
            </h2>
            <ul className="mt-3 space-y-2 text-[0.8125rem] leading-5 text-ink-600">
              <li>We never add anything to your CV that you didn&apos;t tell us.</li>
              <li>We never call a job &ldquo;safe&rdquo;. We show you what we found.</li>
              <li>We never send anything to an employer for you.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
