import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getOverview } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { KpiCard, PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { BarChart } from "@/components/admin/bar-chart";
import { TickCircle, MinusCircle, Clock, ArrowRight2, TaskSquare, Card, Judge } from "@/components/icons";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const staff = await requireAdmin("overview");
  const o = await getOverview(staff);
  const queue = [
    { show: can(staff.role, "reviews"), href: "/admin/reviews", icon: TaskSquare, label: "Truth reports open", value: o.queue.openReports, sub: o.queue.overdueReports ? `${o.queue.overdueReports} past the 48 hour target` : "All inside 48 hours", urgent: o.queue.overdueReports > 0 },
    { show: can(staff.role, "payments"), href: "/admin/payments", icon: Card, label: "Payments pending", value: o.queue.pendingPayments, sub: "Bank transfer and USSD settle on their own", urgent: false },
    { show: can(staff.role, "rules"), href: "/admin/rules", icon: Judge, label: "Lists due for review", value: o.queue.listsDue, sub: "Reviewed monthly by a named owner", urgent: o.queue.listsDue > 0 },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader title="Overview" intro="How the product is doing against the PRD targets and gates. Figures cover the last 30 days unless marked." />

      <section aria-label="Needs attention" className="grid gap-3 md:grid-cols-3">
        {queue.map(({ href, icon: Icon, label, value, sub, urgent }) => (
          <Link key={href} href={href} className="lift flex items-center gap-4 rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
            <span className={`grid size-12 place-items-center rounded-2xl ${urgent ? "bg-care-50 text-care-700" : "bg-brand-50 text-brand-700"}`}>
              <Icon size={24} variant="bulk" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] text-ink-500">{label}</span>
              <span className="block font-display text-2xl font-semibold text-ink-900">{value}</span>
              <span className={`block truncate text-xs ${urgent ? "font-medium text-care-700" : "text-ink-500"}`}>{sub}</span>
            </span>
            <ArrowRight2 size={18} className="text-ink-400" />
          </Link>
        ))}
      </section>

      <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {o.kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="New accounts per day, last 14 days">
          <BarChart data={o.signups} label="new accounts" />
        </Panel>
        <Panel title="Launch gates">
          <ul className="divide-y divide-ink-100">
            {o.gates.map((g) => (
              <li key={g.name} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900">{g.name}</p>
                  <StatusPill status={g.state === "passed" ? "good" : g.state === "in_progress" ? "warn" : "none"} label={g.state === "passed" ? "Passed" : g.state === "in_progress" ? "In progress" : "Not started"} />
                </div>
                <ul className="mt-2 space-y-1.5">
                  {g.checks.map((c) => (
                    <li key={c.text} className="flex items-center gap-2 text-[0.8125rem] text-ink-600">
                      {c.ok === true ? <TickCircle size={16} variant="bulk" className="text-proof-600" /> : c.ok === false ? <MinusCircle size={16} variant="bulk" className="text-care-600" /> : <Clock size={16} className="text-ink-400" />}
                      <span>
                        {c.text}
                        <span className="sr-only">{c.ok === true ? ": met" : c.ok === false ? ": not met" : ": not measured yet"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
