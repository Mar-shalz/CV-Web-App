import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getHomeData } from "@/lib/home-data";
import { accessState } from "@/lib/entitlements";
import { firstName, formatDate, greeting } from "@/lib/format";
import { LIMITS } from "@/lib/config";
import { StatCard } from "@/components/home/stat-card";
import { TailorHero } from "@/components/home/tailor-hero";
import { RecentApplications } from "@/components/home/recent-applications";
import { VaultCard } from "@/components/home/vault-card";
import { GettingStarted } from "@/components/home/getting-started";
import { Send2, TickCircle, Clock, Briefcase, ShieldTick } from "@/components/icons";

export const metadata: Metadata = { title: "Home" };

const PROMISES = [
  { title: "Only your real experience", body: "We never add anything to your CV that you didn't tell us." },
  { title: "Honest job checks", body: "We never call a job \u201csafe\u201d. We show you what we found, so you decide." },
  { title: "You stay in control", body: "We never send anything to an employer for you. You send it yourself." },
  { title: "Your data is yours", body: "Download it or delete it any time in Settings." },
];

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

  // Setup shows until the first application is sent. Step 2 is done once a CV has been
  // tailored to a job (D-104), not just when a job was added.
  const isNew = data.stats.sent === 0;
  const vaultReady = data.stats.vaultConfirmed >= LIMITS.onboarding.vault_ready_items;
  const doneUpTo = !vaultReady ? 0 : data.stats.cvs > 0 ? 2 : 1;
  const name = firstName(viewer.fullName);

  return (
    <div className="stagger space-y-3">
      <header style={{ "--i": 0 } as CSSProperties} className="pb-1">
        <p className="text-sm text-ink-500">{formatDate(new Date())}</p>
        <h1 className="mt-0.5 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-[0.9375rem] text-ink-500">{isNew ? "Let's set you up to apply with proof." : "Here's where your job hunt stands."}</p>
      </header>

      {isNew ? (
        <div style={{ "--i": 1 } as CSSProperties}>
          <GettingStarted doneUpTo={doneUpTo} />
        </div>
      ) : (
        <ul style={{ "--i": 1 } as CSSProperties} className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Your numbers">
          <li>
            <StatCard href="/applications" label="Applications sent" value={data.stats.sent} icon={<Send2 size={22} variant="bulk" />} tint="brand" hint="Quality over quantity" />
          </li>
          <li>
            <StatCard href="/applications?status=invited" label="Interview invites" value={data.stats.invites} icon={<TickCircle size={22} variant="bulk" />} tint="proof" hint="From employers who replied" />
          </li>
          <li>
            <StatCard href="/applications?status=waiting" label="Waiting to hear back" value={data.stats.awaiting} icon={<Clock size={22} variant="bulk" />} tint="care" hint="Sent in the last 30 days" />
          </li>
          <li>
            <StatCard href="/experience" label="Work experience" value={data.stats.workRoles} icon={<Briefcase size={22} variant="bulk" />} tint="sky" hint={`${data.stats.vaultConfirmed} achievements confirmed`} />
          </li>
        </ul>
      )}

      {/* Phones: My Experience sits right under the overview (founder, round 24). */}
      <div style={{ "--i": 2 } as CSSProperties} className="lg:hidden">
        <VaultCard confirmed={data.stats.vaultConfirmed} />
      </div>

      {/* Phones have Tailor CV in the bottom bar, so the big banner is for wider screens only. */}
      <div style={{ "--i": 3 } as CSSProperties} className="hidden lg:block">
        <TailorHero trialReady={access.kind === "trial_ready"} />
      </div>

      <div
        style={{ "--i": 4 } as CSSProperties}
        className={data.recent.length === 0 ? "grid gap-3 md:grid-cols-2" : "grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]"}
      >
        {data.recent.length === 0 ? null : (
          <div className="min-w-0">
            <RecentApplications items={data.recent} />
          </div>
        )}
        <div className={data.recent.length === 0 ? "contents" : "flex flex-col gap-3"}>
          {/* The plan card lives in the sidebar on wide screens and in Settings on phones (round 24). */}
          <div className="hidden lg:block">
            <VaultCard confirmed={data.stats.vaultConfirmed} />
          </div>
          <section aria-labelledby="promise-title" className="flex-1 rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
            <h2 id="promise-title" className="flex items-center gap-3 font-display text-lg font-semibold tracking-[-0.01em] text-ink-900">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <ShieldTick size={22} variant="bulk" />
              </span>
              Our promise to you
            </h2>
            <ul className="mt-4 space-y-3.5">
              {PROMISES.map((p) => (
                <li key={p.title} className="flex gap-3">
                  {/* A small plain tick, so the list doesn't compete with the shield above. */}
                  <span aria-hidden="true" className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full bg-ink-75">
                    <span className="block h-1.5 w-2.5 -translate-y-px rotate-[-45deg] border-b-2 border-l-2 border-brand-700" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{p.title}</span>
                    <span className="block text-[0.8125rem] leading-5 text-ink-600">{p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
