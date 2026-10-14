import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AdminNav, AdminMobileNav } from "@/components/admin/admin-nav";
import { SubmitButton } from "@/components/auth/submit-button";
import { signOutAdmin } from "@/app/admin/actions";
import { Avatar } from "@/components/shell/user-chip";
import { getStaff, getAdminUser } from "@/lib/admin/auth";
import { PERMISSIONS, can, ROLE_LABELS } from "@/lib/admin/permissions";
import { ShieldTick, Logout } from "@/components/icons";

export const metadata: Metadata = { title: { default: "Back Office", template: "%s · Back Office" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  // Signed out visits go to the back office sign in (proxy.ts). Signed in with an account
  // that isn't on the team: the sign in page says so and offers to switch accounts (D-127).
  if (!staff) {
    if (await getAdminUser()) redirect("/admin/sign-in");
    notFound();
  }
  const allowed = PERMISSIONS.filter((p) => can(staff.role, p));

  return (
    <div className="flex min-h-dvh bg-[#f3f5fa]">
      {/* Fixed to the screen height and never scrolls: the page scrolls beside it. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col overflow-hidden bg-brand-950 pb-4 lg:flex">
        <div className="flex h-[72px] shrink-0 items-center px-7">
          <Logo tone="onDark" />
        </div>
        <div className="mx-6 mb-4 shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 [@media(max-height:700px)]:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">Back Office</p>
          <p className="mt-0.5 text-xs text-white/60">Staff only. Every view is logged.</p>
        </div>
        {staff.mfa ? <AdminNav allowed={allowed} /> : <div className="flex-1" />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[272px]">
        {staff.preview ? (
          <p className="bg-care-50 px-4 py-2 text-center text-[0.8125rem] font-medium text-care-700">Preview mode: sample data, no database connected.</p>
        ) : null}
        <header className="sticky top-0 z-20 border-b border-ink-150 bg-white/90 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-[76px] lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo collapsed />
              <span className="text-sm font-semibold text-brand-900">Back Office</span>
            </div>
            <span className="hidden items-center gap-2 rounded-full bg-proof-50 px-3 py-1.5 text-xs font-semibold text-proof-700 lg:inline-flex">
              <ShieldTick size={16} variant="bulk" />
              {staff.mfa ? "Two factor sign in verified" : "Two factor sign in needed"}
            </span>
            <div className="flex items-center gap-3">
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-sm font-semibold text-ink-900">{staff.name ?? "Staff"}</span>
                <span className="text-xs text-ink-500">{ROLE_LABELS[staff.role].label}</span>
              </span>
              <Avatar name={staff.name} size={40} />
              <form action={signOutAdmin}>
                <SubmitButton variant="secondary" size="sm" pendingLabel="Signing out" aria-label="Sign out of the back office">
                  <Logout size={18} />
                  <span className="hidden sm:inline">Sign out</span>
                </SubmitButton>
              </form>
            </div>
          </div>
          {staff.mfa ? <AdminMobileNav allowed={allowed} /> : null}
        </header>
        <main id="main" className="w-full max-w-[1480px] space-y-3 px-4 pb-8 pt-5 lg:px-8 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
