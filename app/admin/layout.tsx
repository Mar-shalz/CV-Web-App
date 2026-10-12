import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { Avatar } from "@/components/shell/user-chip";
import { getStaff } from "@/lib/admin/auth";
import { PERMISSIONS, can, ROLE_LABELS } from "@/lib/admin/permissions";
import { ShieldTick } from "@/components/icons";

export const metadata: Metadata = { title: { default: "Back office", template: "%s · Back office" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  // Non staff get a plain 404: the back office never admits it exists.
  if (!staff) notFound();
  const allowed = PERMISSIONS.filter((p) => can(staff.role, p));

  return (
    <div className="flex min-h-dvh bg-[#f3f5fa]">
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col bg-brand-950 lg:flex">
        <div className="flex h-[84px] items-center px-7">
          <Logo tone="onDark" />
        </div>
        <div className="mx-6 mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">Back office</p>
          <p className="mt-0.5 text-xs text-white/60">Staff only. Every view is logged.</p>
        </div>
        <div className="flex-1 overflow-y-auto">{staff.mfa ? <AdminNav allowed={allowed} /> : null}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {staff.preview ? (
          <p className="bg-care-50 px-4 py-2 text-center text-[0.8125rem] font-medium text-care-700">Preview mode: sample data, no database connected.</p>
        ) : null}
        <header className="sticky top-0 z-20 border-b border-ink-150 bg-white/90 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-[76px] lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo collapsed />
              <span className="text-sm font-semibold text-brand-900">Back office</span>
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
            </div>
          </div>
          {staff.mfa ? (
            <nav aria-label="Back office" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-ink-100 px-3 py-2 lg:hidden">
              {allowed
                .filter((p) => !p.includes("."))
                .map((p) => (
                  <a key={p} href={p === "overview" ? "/admin" : `/admin/${p === "reviews" ? "reviews" : p}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-ink-75 px-3.5 text-sm font-medium capitalize text-ink-700">
                    {p}
                  </a>
                ))}
            </nav>
          ) : null}
        </header>
        <main id="main" className="w-full max-w-[1480px] flex-1 space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
