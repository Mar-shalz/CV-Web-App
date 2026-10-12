import Link from "next/link";
import type { HomeApplication } from "@/lib/home-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowRight2, Sms, DocumentText, Global } from "@/components/icons";
import { formatDate } from "@/lib/format";

const CHANNEL = {
  email: { icon: Sms, label: "Email" },
  form: { icon: DocumentText, label: "Google Form" },
  portal: { icon: Global, label: "Employer website" },
} as const;

export function RecentApplications({ items, title = "Recent applications", showAll = true }: { items: HomeApplication[]; title?: string; showAll?: boolean }) {
  return (
    <section aria-labelledby="recent-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
      <div className="flex min-h-12 items-center justify-between gap-3 px-5 pt-5">
        <h2 id="recent-title" className="text-lg font-semibold text-ink-900">
          {title}
        </h2>
        {showAll ? (
        <Link href="/applications" className="inline-flex min-h-12 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          See all
          <ArrowRight2 size={16} />
        </Link>
        ) : null}
      </div>
      <div className="mt-2 hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-y border-ink-100 bg-ink-50/60 px-5 py-2.5 text-xs font-medium text-ink-500 lg:grid">
        <span>Job</span>
        <span>Sent</span>
        <span>Status</span>
        <span className="w-5" />
      </div>
      <ul className="divide-y divide-ink-100 px-2 pb-2 lg:px-0">
        {items.map((a) => {
          const ch = a.channel ? CHANNEL[a.channel] : null;
          const Icon = ch?.icon ?? DocumentText;
          return (
            <li key={a.id}>
              <Link
                href={`/applications/${a.id}`}
                className="grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-ink-50 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-4 lg:rounded-none lg:px-5"
              >
                <span className="flex min-w-0 items-center gap-3.5 max-lg:contents">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink-75 text-ink-700">
                    <Icon size={20} />
                    <span className="sr-only">{ch?.label ?? "Application"}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold text-ink-900">{a.title}</span>
                    <span className="block truncate text-[0.8125rem] text-ink-500">
                      {a.employer}
                      <span className="lg:hidden">{a.sentAt ? ` · ${formatDate(a.sentAt)}` : " · Not sent yet"}</span>
                    </span>
                    <span className="mt-1.5 block lg:hidden">
                      <StatusBadge status={a.status} />
                    </span>
                  </span>
                </span>
                <span className="hidden text-sm text-ink-600 lg:block">{a.sentAt ? formatDate(a.sentAt) : "Not sent yet"}</span>
                <span className="hidden lg:block">
                  <StatusBadge status={a.status} />
                </span>
                <ArrowRight2 size={18} className="text-ink-400" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
