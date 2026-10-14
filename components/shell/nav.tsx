"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Category, Magicpen, Send2, Briefcase, Setting2, ArrowLeft2, ArrowRight2, Global } from "@/components/icons";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS, type NavItem } from "./nav-items";

// "Tailor my CV" lives in the top bar on wide screens and in the centre of the phone bar,
// so the sidebar keeps to places, not actions.
const SIDEBAR_ITEMS = NAV_ITEMS.filter((i) => !("primary" in i));

const ICONS = { home: Category, tailor: Magicpen, applications: Send2, experience: Briefcase, settings: Setting2 };

function isActive(path: string, href: string) {
  // Tailoring a CV is part of an application: Applications stays lit through every step.
  if (href === "/applications") return path.startsWith("/applications") || path.startsWith("/jobs");
  if (href === "/jobs/new") return path === "/jobs/new";
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
        collapsed ? "w-[108px]" : "w-[248px]"
      }`}
    >
      {/* The collapse control always sits beside the logo, so collapsing never adds a row. */}
      <div className={`flex h-[76px] items-center ${collapsed ? "justify-center gap-3 px-2" : "justify-between pl-6 pr-3"}`}>
        <Link href="/home" className="rounded-xl" aria-label="Home">
          <Logo collapsed={collapsed} />
        </Link>
        <button
          type="button"
          onClick={toggle}
          className={`grid shrink-0 place-items-center rounded-full bg-white text-ink-600 shadow-[0_2px_8px_-2px_rgb(15_23_42/0.18),0_0_0_1px_rgb(15_23_42/0.06)] transition-[color,box-shadow,transform] hover:text-brand-700 hover:shadow-[0_6px_16px_-4px_rgb(30_71_217/0.35),0_0_0_1px_rgb(30_71_217/0.15)] active:scale-95 size-9`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {/* Two chevrons with a clear gap between them: a double arrow, not a blur. */}
          <span className="flex -space-x-2" aria-hidden="true">
            {collapsed ? <ArrowRight2 size={16} /> : <ArrowLeft2 size={16} />}
            {collapsed ? <ArrowRight2 size={16} /> : <ArrowLeft2 size={16} />}
          </span>
        </button>
      </div>
      <div className="mx-4 h-px bg-ink-150" aria-hidden="true" />

      <nav aria-label="Main" className="mt-4 flex-1">
        <ul className="space-y-1 px-3">
          {SIDEBAR_ITEMS.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(path, item.href)} collapsed={collapsed} />
          ))}
        </ul>
      </nav>

      <div className={collapsed ? "px-3 pb-5" : "px-4 pb-5"}>
        {collapsed ? footerCollapsed : footer}
        {/* The browser extension, for laptops and tablets (D-138). Get help moved to the top bar. */}
        <Link
          href="/extension"
          aria-current={path === "/extension" ? "page" : undefined}
          title={collapsed ? "Chrome extension" : undefined}
          className={`group mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-ink-150 text-sm transition-colors hover:border-brand-200 hover:bg-brand-50 ${collapsed ? "justify-center" : "px-3 py-2"} ${path === "/extension" ? "border-brand-200 bg-brand-50" : ""}`}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-white">
            <Global size={18} variant="bulk" />
          </span>
          <span className={collapsed ? "sr-only" : "min-w-0 leading-tight"}>
            <span className="block font-semibold text-ink-900">Chrome extension</span>
            <span className="block text-xs text-ink-500">Send any job here in one click</span>
          </span>
        </Link>
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
        className={`group relative flex min-h-[52px] items-center gap-3.5 overflow-hidden rounded-xl text-[0.9375rem] transition-colors duration-200 ${
          collapsed ? "justify-center" : "pl-5 pr-3"
        } ${active ? "nav-active font-semibold text-brand-900" : "font-medium text-ink-500 hover:bg-ink-75 hover:text-ink-900"}`}
      >
        {/* The bar is the pill's left edge: the rounded, clipped corners give it the curve. */}
        <span
          className={`absolute inset-y-0 left-0 w-[6px] origin-center bg-brand-900 transition-transform duration-300 ${active ? "scale-y-100" : "scale-y-0"}`}
          aria-hidden="true"
        />
        <Icon size={22} variant="linear" className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${active ? "text-brand-900" : ""}`} />
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
