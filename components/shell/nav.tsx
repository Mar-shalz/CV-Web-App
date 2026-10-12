"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Category, Magicpen, Send2, Briefcase, Setting2, ArrowLeft2, ArrowRight2, MessageQuestion } from "@/components/icons";
import { Logo } from "@/components/brand/logo";
import { APP } from "@/lib/config";
import { NAV_ITEMS, type NavItem } from "./nav-items";

const ICONS = { home: Category, tailor: Magicpen, applications: Send2, experience: Briefcase, settings: Setting2 };

function isActive(path: string, href: string) {
  if (href === "/jobs/new") return path.startsWith("/jobs");
  return path === href || path.startsWith(`${href}/`);
}

/** Desktop sidebar. Collapses to icons; the choice is kept in a cookie so the server renders it right. */
export function Sidebar({ initialCollapsed, footer, footerCollapsed }: { initialCollapsed: boolean; footer: ReactNode; footerCollapsed: ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sb_collapsed=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-ink-150 bg-white transition-[width] duration-300 ease-[var(--ease-out)] lg:flex ${
        collapsed ? "w-[92px]" : "w-[272px]"
      }`}
    >
      <div className={`flex h-[84px] items-center ${collapsed ? "justify-center px-3" : "justify-between pl-7 pr-4"}`}>
        <Link href="/home" className="rounded-xl" aria-label="Home">
          <Logo collapsed={collapsed} />
        </Link>
        {!collapsed ? (
          <button
            type="button"
            onClick={toggle}
            className="grid size-10 place-items-center rounded-xl text-ink-500 transition-colors hover:bg-ink-75 hover:text-ink-900"
            aria-label="Collapse sidebar"
            aria-expanded="true"
          >
            <span className="flex -space-x-3">
              <ArrowLeft2 size={18} />
              <ArrowLeft2 size={18} />
            </span>
          </button>
        ) : null}
      </div>
      <div className="mx-5 h-px bg-ink-150" aria-hidden="true" />

      {collapsed ? (
        <button
          type="button"
          onClick={toggle}
          className="mx-auto mt-4 grid size-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-75 hover:text-ink-900"
          aria-label="Expand sidebar"
          aria-expanded="false"
        >
          <span className="flex -space-x-3">
            <ArrowRight2 size={18} />
            <ArrowRight2 size={18} />
          </span>
        </button>
      ) : null}

      <nav aria-label="Main" className="mt-6 flex-1">
        <ul className="space-y-1.5 pr-4">
          {NAV_ITEMS.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(path, item.href)} collapsed={collapsed} />
          ))}
        </ul>
      </nav>

      <div className={collapsed ? "px-3 pb-6" : "px-5 pb-6"}>
        {collapsed ? footerCollapsed : footer}
        <a
          href={`mailto:${APP.support_email}`}
          className={`mt-3 flex min-h-12 items-center gap-3 rounded-2xl text-sm font-medium text-ink-600 hover:bg-ink-75 hover:text-ink-900 ${
            collapsed ? "justify-center" : "px-3"
          }`}
          title={collapsed ? "Get help" : undefined}
        >
          <MessageQuestion size={20} />
          <span className={collapsed ? "sr-only" : ""}>Get help</span>
        </a>
      </div>
    </aside>
  );
}

function SideLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={`group relative flex min-h-12 items-center gap-3.5 rounded-r-2xl text-[0.9375rem] transition-colors duration-200 ${
          collapsed ? "justify-center pl-4" : "pl-7"
        } ${active ? "nav-active font-semibold text-brand-900" : "font-medium text-ink-500 hover:bg-ink-75/70 hover:text-ink-900"}`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-[5px] rounded-r-full bg-brand-800 transition-transform duration-300 ${active ? "scale-y-100" : "scale-y-0"}`}
          aria-hidden="true"
        />
        <Icon size={22} variant={active ? "bulk" : "linear"} className="shrink-0 transition-transform duration-200 group-hover:scale-105" />
        <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
      </Link>
    </li>
  );
}

// Phone order puts the main action in the thumb's centre.
const MOBILE_ORDER = [NAV_ITEMS[0], NAV_ITEMS[2], NAV_ITEMS[1], NAV_ITEMS[3], NAV_ITEMS[4]];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-150 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_ORDER.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(path, item.href);
          if ("primary" in item && item.primary) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link href={item.href} aria-current={active ? "page" : undefined} className="-mt-6 flex min-h-16 flex-col items-center gap-1 px-1 text-xs font-semibold text-brand-700">
                  <span className="grid size-[52px] place-items-center rounded-[18px] bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-[var(--shadow-cta)] ring-4 ring-white transition-transform active:scale-95">
                    <Icon size={24} variant="bulk" />
                  </span>
                  {item.short}
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "font-semibold text-brand-800" : "font-medium text-ink-500"}`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 ${active ? "bg-brand-50" : ""}`}>
                  <Icon size={22} variant={active ? "bulk" : "linear"} />
                </span>
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
