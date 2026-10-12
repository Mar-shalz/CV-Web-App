import Link from "next/link";
import { cookies } from "next/headers";
import { Mark } from "@/components/brand/logo";
import { Sidebar, BottomNav } from "@/components/shell/nav";
import { AccessBadge, AccessCard } from "@/components/shell/access-card";
import { Avatar, UserChip } from "@/components/shell/user-chip";
import { ButtonLink } from "@/components/ui/button";
import { Magicpen, Notification, SearchNormal1 } from "@/components/icons";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { accessState } from "@/lib/entitlements";
import { getCheckInCount } from "@/lib/home-data";
import { APP_NAME, MARKETS } from "@/lib/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireReadyViewer();
  const [jar, checkIns] = await Promise.all([cookies(), getCheckInCount(viewer)]);
  const access = accessState({
    trialStartedAt: viewer.trial.startedAt,
    trialEndsAt: viewer.trial.endsAt,
    trialCvsUsed: viewer.trial.cvsUsed,
    activePass: viewer.activePass,
  });
  const stageLabel = MARKETS.career_stages.find((s) => s.id === viewer.careerStage)?.label ?? null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar initialCollapsed={jar.get("sb_collapsed")?.value === "1"} footer={<AccessCard state={access} />} footerCollapsed={<AccessBadge state={access} />} />

      <div className="flex min-w-0 flex-1 flex-col">
        {viewer.preview ? (
          <p className="bg-care-50 px-4 py-2 text-center text-[0.8125rem] font-medium text-care-700">
            Preview mode: sample data, no database connected. This banner never shows in production.
          </p>
        ) : null}

        <header className="sticky top-0 z-20 border-b border-ink-150 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 lg:h-[84px] lg:gap-4 lg:px-8 xl:px-10">
            <Link href="/home" className="flex items-center gap-2 lg:hidden" aria-label={`${APP_NAME} home`}>
              <Mark size={34} />
              <span className="font-display text-lg font-semibold tracking-[-0.02em] text-brand-900">{APP_NAME}</span>
            </Link>

            <form action="/applications" role="search" className="relative hidden w-full max-w-[420px] lg:block">
              <label htmlFor="app-search" className="sr-only">
                Search your applications
              </label>
              <SearchNormal1 size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                id="app-search"
                name="q"
                type="search"
                placeholder="Search jobs, employers or applications"
                className="h-12 w-full rounded-full border border-transparent bg-ink-75 pl-12 pr-4 text-[0.9375rem] text-ink-900 placeholder:text-ink-500 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </form>

            <div className="ml-auto flex items-center gap-2 lg:gap-3">
              <Link
                href="/home#checkins"
                className="relative grid size-12 place-items-center rounded-full bg-ink-75 text-ink-700 transition-colors hover:bg-ink-100"
                aria-label={checkIns ? `${checkIns} applications waiting for an update` : "No updates waiting"}
              >
                <Notification size={22} />
                {checkIns ? (
                  <span className="absolute right-2.5 top-2.5 grid size-[18px] place-items-center rounded-full bg-flag-600 text-[0.6875rem] font-semibold text-white ring-2 ring-white" aria-hidden="true">
                    {checkIns}
                  </span>
                ) : null}
              </Link>
              <span className="hidden lg:block">
                <ButtonLink href="/jobs/new" className="cta-sheen">
                  <Magicpen size={20} variant="bulk" />
                  Tailor my CV
                </ButtonLink>
              </span>
              <span className="hidden lg:block">
                <UserChip name={viewer.fullName} stageLabel={stageLabel} />
              </span>
              <Link href="/settings" className="grid min-h-12 min-w-12 place-items-center lg:hidden" aria-label="Account and settings">
                <Avatar name={viewer.fullName} size={40} />
              </Link>
            </div>
          </div>
        </header>

        {/* Content sits close to the sidebar on wide screens instead of floating in the middle. */}
        <main id="main" className="w-full max-w-[1480px] flex-1 px-4 pb-32 pt-5 lg:px-8 lg:pb-12 lg:pt-8 xl:px-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
