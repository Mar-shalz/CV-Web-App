import Link from "next/link";
import { cookies } from "next/headers";
import { VisitBeacon } from "@/components/shell/visit-beacon";
import { Mark } from "@/components/brand/logo";
import { Sidebar, BottomNav } from "@/components/shell/nav";
import { AccessBadge, AccessCard } from "@/components/shell/access-card";
import { Avatar, UserChip } from "@/components/shell/user-chip";
import { ButtonLink } from "@/components/ui/button";
import { Magicpen, SearchNormal1 } from "@/components/icons";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { accessState } from "@/lib/entitlements";
import { getCheckIns } from "@/lib/home-data";
import { getInbox } from "@/lib/notifications/data";
import { UpdatesDrawer } from "@/components/shell/updates-drawer";
import { CheckInItem } from "@/components/home/check-in-item";
import { APP_NAME, MARKETS } from "@/lib/config";

export default async function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const viewer = await requireReadyViewer();
  const [jar, checkIns, inbox] = await Promise.all([cookies(), getCheckIns(viewer), getInbox(viewer)]);
  const access = accessState({
    trialStartedAt: viewer.trial.startedAt,
    trialEndsAt: viewer.trial.endsAt,
    trialCvsUsed: viewer.trial.cvsUsed,
    activePass: viewer.activePass,
  });
  const stageLabel = MARKETS.career_stages.find((s) => s.id === viewer.careerStage)?.label ?? null;

  return (
    <div className="flex min-h-dvh" data-app-shell="" data-low-data={viewer.lowDataMode || undefined}>
      <VisitBeacon />
      <Sidebar initialCollapsed={jar.get("sb_collapsed")?.value === "1"} footer={<AccessCard state={access} />} footerCollapsed={<AccessBadge state={access} />} />

      <div className="flex min-w-0 flex-1 flex-col">
        {viewer.preview ? (
          <p className="bg-care-50 px-4 py-2 text-center text-[0.8125rem] font-medium text-care-700">
            Preview mode: sample data, no database connected. This banner never shows in production.
          </p>
        ) : null}

        <header className="sticky top-0 z-20 border-b border-ink-150 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 lg:h-[76px] lg:gap-4 lg:px-6">
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
                className="h-12 w-full rounded-full border border-transparent bg-ink-75 pl-12 pr-4 text-[0.9375rem] text-ink-900 placeholder:text-ink-350 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </form>

            <div className="ml-auto flex items-center gap-2 lg:gap-3">
              <Link href="/settings" className="low-data-chip min-h-9 items-center gap-1.5 rounded-full bg-proof-50 px-3 text-xs font-semibold text-proof-700" title="Data saver is on: no animations, phone fonts, fewer pictures">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-proof-600" />
                Data saver on
              </Link>
              <UpdatesDrawer
                checkInCount={checkIns.length}
                items={inbox.items}
                checkIns={
                  <ul className="space-y-2.5">
                    {checkIns.map((a) => (
                      <li key={a.id} className="rounded-xl border border-ink-150 bg-white p-3.5 shadow-card">
                        <CheckInItem a={a} />
                      </li>
                    ))}
                  </ul>
                }
              />
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

        {/* Same side padding as the top bar, so content lines up with its right edge. */}
        <main id="main" className="w-full flex-1 px-4 pb-32 pt-4 lg:px-6 lg:pb-10 lg:pt-5">
          {children}
        </main>
      </div>

      <BottomNav />
      {modal}
    </div>
  );
}
