"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Category, Profile2User, ClipboardText, Card, TaskSquare, Judge, Cpu, Book1, People, ArrowLeft, Messages2 } from "./icons";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: Category, perm: "overview" },
  { href: "/admin/users", label: "Users", icon: Profile2User, perm: "users" },
  { href: "/admin/waitlist", label: "Waitlist", icon: ClipboardText, perm: "waitlist" },
  { href: "/admin/payments", label: "Payments", icon: Card, perm: "payments" },
  { href: "/admin/messages", label: "Messages to users", icon: Messages2, perm: "messages" },
  { href: "/admin/reviews", label: "Truth reviews", icon: TaskSquare, perm: "reviews" },
  { href: "/admin/rules", label: "Rules and lists", icon: Judge, perm: "rules" },
  { href: "/admin/ai", label: "AI cost and quality", icon: Cpu, perm: "ai" },
  { href: "/admin/audit", label: "Audit log", icon: Book1, perm: "audit" },
  { href: "/admin/team", label: "Team and access", icon: People, perm: "team" },
] as const;

export function AdminNav({ allowed }: { allowed: string[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Back office">
      <ul className="space-y-1 pr-4">
        {ITEMS.filter((i) => allowed.includes(i.perm)).map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 items-center gap-3 rounded-r-2xl pl-6 text-[0.9375rem] transition-colors ${
                  active ? "bg-gradient-to-r from-white/15 via-white/5 to-transparent font-semibold text-white" : "font-medium text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-[5px] rounded-r-full bg-sky-300 transition-transform ${active ? "scale-y-100" : "scale-y-0"}`} aria-hidden="true" />
                <Icon size={21} variant={active ? "bulk" : "linear"} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/home" className="mt-6 flex min-h-12 items-center gap-3 rounded-r-2xl pl-6 text-sm font-medium text-white/65 hover:text-white">
        <ArrowLeft size={20} />
        Back to the app
      </Link>
    </nav>
  );
}
