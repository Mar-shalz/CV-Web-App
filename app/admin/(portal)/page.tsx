import { requireAdmin } from "@/lib/admin/auth";
import { getOverview } from "@/lib/admin/data";
import { designUsage } from "@/lib/cv/design-usage";
import { opsSummary } from "@/lib/ops";
import { formatDate } from "@/lib/format";
import { CV_STYLES, CV_STYLE_INFO } from "@/lib/cv/styles";
import { can } from "@/lib/admin/permissions";
import { KpiCard, PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { BarChart } from "@/components/admin/bar-chart";
import { StatCard } from "@/components/home/stat-card";
import { TickCircle, MinusCircle, Clock, TaskSquare, Card, Judge, Profile2User } from "@/components/icons";

export const metadata = { title: { absolute: "Overview · Back Office" } };

export default async function AdminOverview() {
  const staff = await requireAdmin("overview");
  const [o, designs, gmail] = await Promise.all([getOverview(staff), designUsage(), opsSummary("gmail_attach_failed")]);
  const designTotal = CV_STYLES.reduce((n, s) => n + designs.downloads[s], 0);
  // Same cards as the app's Home: label, icon, number, one line of context.
  const queue = [
    { show: can(staff.role, "reviews"), href: "/admin/reviews", icon: <TaskSquare size={22} variant="bulk" />, tint: o.queue.overdueReports ? "care" : "brand", label: "Truth reports open", value: o.queue.openReports, hint: o.queue.overdueReports ? `${o.queue.overdueReports} past 48 hours` : "All inside 48 hours" },
    { show: can(staff.role, "payments"), href: "/admin/payments", icon: <Card size={22} variant="bulk" />, tint: "proof", label: "Payments pending", value: o.queue.pendingPayments, hint: "Transfers settle on their own" },
    { show: can(staff.role, "rules"), href: "/admin/rules", icon: <Judge size={22} variant="bulk" />, tint: o.queue.listsDue ? "care" : "sky", label: "Lists due for review", value: o.queue.listsDue, hint: "Reviewed monthly" },
    { show: can(staff.role, "users"), href: "/admin/users", icon: <Profile2User size={22} variant="bulk" />, tint: "sky", label: "Accounts", value: o.queue.accounts, hint: `${o.queue.newThisWeek} joined this week` },
  ].filter((q) => q.show) as { href: string; icon: React.ReactNode; tint: "brand" | "proof" | "care" | "sky"; label: string; value: number; hint: string }[];

  return (
    <>
      <PageHeader title="Overview" intro="How the product is doing against its targets and launch gates. Figures cover the last 30 days unless marked. Open “How it's counted” on any card to see what it measures." />

      <ul aria-label="Needs attention" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {queue.map((q, i) => (
          <li key={q.href}>
            <StatCard href={q.href} label={q.label} value={q.value} icon={q.icon} tint={q.tint} hint={q.hint} i={i} />
          </li>
        ))}
      </ul>

      <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {o.kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
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

      {/* Gmail changed its page and the extension couldn't attach CVs (D-181). */}
      {gmail.count ? (
        <Panel title="Needs a fix: Gmail attach" action={<span className="text-xs text-ink-500">last 7 days</span>}>
          <div className="p-5 text-sm text-ink-700">
            <p>
              <span className="font-semibold text-flag-700">{gmail.count} {gmail.count === 1 ? "time" : "times"}</span> the extension couldn&apos;t attach a CV in Gmail
              {gmail.last ? `, most recently ${formatDate(gmail.last)}` : ""}. People were told and their CV was saved to attach by hand. Check extension/gmail.js against Gmail&apos;s compose window.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {gmail.reasons.map((r) => (
                <li key={r.reason} className="rounded-full bg-ink-75 px-2.5 py-1 text-xs font-medium text-ink-700">
                  {r.reason.replaceAll("_", " ")}: {r.count}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      ) : null}

      {/* Add CV designs when the numbers say so (D-148). */}
      <Panel title="CV designs, last 30 days" action={<span className="text-xs text-ink-500">{designTotal} downloads</span>}>
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Downloads by design</p>
            <ul className="mt-2 space-y-2">
              {CV_STYLES.map((s) => {
                const n = designs.downloads[s];
                const pct = designTotal ? Math.round((n / designTotal) * 100) : 0;
                return (
                  <li key={s}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-ink-900">{CV_STYLE_INFO[s].label}</span>
                      <span className="tabular-nums text-ink-600">
                        {n} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Asked for another design</p>
            {designs.requests.length ? (
              <ul className="mt-2 divide-y divide-ink-100">
                {designs.requests.map((r) => (
                  <li key={r.reason} className="flex justify-between py-2 text-sm">
                    <span className="text-ink-900">{r.reason}</span>
                    <span className="font-semibold tabular-nums text-ink-700">{r.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">{designs.ready ? "No requests yet." : "Shows once the latest database update has been run."}</p>
            )}
            <p className="mt-3 text-xs leading-5 text-ink-500">Rule of thumb: add a design when one request reaches about 1 in 10 downloads. Two columns and photos hurt hiring software, so weigh those carefully.</p>
          </div>
        </div>
      </Panel>
    </>
  );
}
