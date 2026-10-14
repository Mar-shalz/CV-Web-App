"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Category, Profile2User, Card, TaskSquare, Judge, Cpu, Book1, People, Messages2 } from "./icons";

const ITEMS = [
  { href: "/admin", label: "Overview", short: "Overview", icon: Category, perm: "overview" },
  { href: "/admin/users", label: "Users", short: "Users", icon: Profile2User, perm: "users" },
  { href: "/admin/payments", label: "Payments", short: "Payments", icon: Card, perm: "payments" },
  { href: "/admin/messages", label: "Messages to Users", short: "Messages", icon: Messages2, perm: "messages" },
  { href: "/admin/reviews", label: "Truth Reviews", short: "Reviews", icon: TaskSquare, perm: "reviews" },
  { href: "/admin/rules", label: "Rules and Lists", short: "Rules", icon: Judge, perm: "rules" },
  { href: "/admin/ai", label: "AI Cost and Quality", short: "AI", icon: Cpu, perm: "ai" },
  { href: "/admin/audit", label: "Audit Log", short: "Audit", icon: Book1, perm: "audit" },
  { href: "/admin/team", label: "Team and Access", short: "Team", icon: People, perm: "team" },
] as const;

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

/** Sidebar links. Sized so all ten fit a 640px tall laptop screen without scrolling. */
export function AdminNav({ allowed }: { allowed: string[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Back office" className="flex flex-1 flex-col">
      <ul className="space-y-0.5 pr-4">
        {ITEMS.filter((i) => allowed.includes(i.perm)).map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-r-2xl pl-6 text-[0.9375rem] transition-colors [@media(max-height:760px)]:min-h-10 ${
                  active ? "bg-gradient-to-r from-white/15 via-white/5 to-transparent font-semibold text-white" : "font-medium text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-[5px] rounded-r-full bg-sky-300 transition-transform ${active ? "scale-y-100" : "scale-y-0"}`} aria-hidden="true" />
                <Icon size={20} variant={active ? "bulk" : "linear"} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phones and tablets: the same sections as a row of chips under the header. */
export function AdminMobileNav({ allowed }: { allowed: string[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Back office" className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-ink-100 px-3 py-2 lg:hidden">
      {ITEMS.filter((i) => allowed.includes(i.perm)).map(({ href, short }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${active ? "bg-brand-900 text-white" : "bg-ink-75 text-ink-700 hover:bg-ink-100"}`}
          >
            {short}
          </Link>
        );
      })}
    </nav>
  );
}
