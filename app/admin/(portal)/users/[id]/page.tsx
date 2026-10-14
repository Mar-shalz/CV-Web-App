import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { getUserDetail } from "@/lib/admin/users";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { BarChart } from "@/components/admin/bar-chart";
import { PlanPill, lastSeen, countryName } from "@/components/admin/user-bits";
import { SuspendControl, DeleteControl } from "@/components/admin/user-controls";
import { formatDate, formatNaira } from "@/lib/format";
import { ArrowLeft, Lock1 } from "@/components/icons";

export const metadata = { title: "User" };

const PAY_STATUS = { active: "good", pending: "warn", expired: "none", failed: "bad", refunded: "none" } as const;

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireAdmin("users");
  const full = can(staff.role, "users.manage");
  const { id } = await params;
  const u = await getUserDetail(staff, id, full);
  if (!u) notFound();
  await logAdminAction(staff, "view", "users", u.id, { full_emails: full });

  const facts: [string, string][] = [
    ["Name", u.name ?? "Not added"],
    ["Signs in with", u.provider === "google" ? "Google" : "Email"],
    ...(full && u.phone ? ([["Phone", u.phone]] as [string, string][]) : []),
    ["Using the app from", countryName(u.country)],
    ["Stage", u.stage],
    ["Applying in", u.markets || "Not set"],
    ["Joined", formatDate(u.joined)],
    ["Last sign in", u.lastSignIn ? lastSeen(u.lastSignIn) : "Not yet"],
  ];

  return (
    <>
      <Link href="/admin/users" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-ink-600 hover:text-ink-900">
        <ArrowLeft size={18} />
        All users
      </Link>
      <PageHeader
        title={u.email}
        intro={u.suspended ? `Paused${u.suspendedReason ? `: ${u.suspendedReason}` : ""}.` : u.setup ? "Account set up." : "Signed up but hasn't finished setup."}
        action={
          <div className="flex flex-wrap gap-2">
            {u.suspended ? <StatusPill status="bad" label="Paused" /> : null}
            <PlanPill plan={u.plan} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Active days, last 7", value: String(u.activeDays7) },
          { label: "Active days, last 30", value: String(u.activeDays30) },
          { label: "Visits, last 30 days", value: String(u.visits30) },
          { label: "Paid in total", value: u.paidKobo ? formatNaira(u.paidKobo) : "None" },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
            <p className="text-[0.8125rem] text-ink-500">{k.label}</p>
            <p className="mt-1 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-ink-900 tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Panel title="Visits per day, last 30 days" action={<span className="text-xs text-ink-500">Last active {lastSeen(u.lastActive).toLowerCase()}</span>}>
            <BarChart data={u.activity} label="Visits" />
            <p className="border-t border-ink-100 px-4 py-2.5 text-xs leading-5 text-ink-500">A visit is each time they open the app. Moving between pages or refreshing doesn&apos;t count; a new visit starts after 30 minutes away.</p>
          </Panel>

          <Panel title="What they've done">
            <dl className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-3">
              {[
                ["Roles in experience", u.counts.roles],
                ["Achievements", `${u.counts.confirmedItems} of ${u.counts.items} confirmed`],
                ["CVs made", u.counts.cvs],
                ["Applications", u.counts.deletedApplications ? `${u.counts.applications + u.counts.deletedApplications} (${u.counts.deletedApplications} deleted by them)` : u.counts.applications],
                ["Interviews", u.counts.interviews],
                ["Offers", u.counts.offers],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-white p-4">
                  <dt className="text-xs text-ink-500">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="flex items-center gap-1.5 border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
              <Lock1 size={14} />
              Counts only. Their CVs, job posts and sensitive details stay private.
            </p>
          </Panel>

          <Panel title="Payments">
            {u.payments.length ? (
              <Table caption="Payments" head={["Product", "Amount", "Status", "Date", "Ends", "Reference"]}>
                {u.payments.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.product}</Td>
                    <Td className="tabular-nums">{formatNaira(p.amountKobo)}</Td>
                    <Td>
                      <StatusPill status={PAY_STATUS[p.status as keyof typeof PAY_STATUS] ?? "none"} label={p.status[0]?.toUpperCase() + p.status.slice(1)} />
                    </Td>
                    <Td className="text-ink-500">{formatDate(p.created)}</Td>
                    <Td className="text-ink-500">{p.endsAt ? formatDate(p.endsAt) : ""}</Td>
                    <Td className="font-mono text-xs text-ink-500">{p.reference ?? ""}</Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="p-5 text-sm text-ink-500">{u.freeAccess ? `No payments. Free access${u.freeAccess.until ? ` until ${formatDate(u.freeAccess.until)}` : ", no end date"}${u.freeAccess.note ? ` (${u.freeAccess.note})` : ""}.` : "No payments yet."}</p>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Details">
            <dl className="divide-y divide-ink-100">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-right font-medium text-ink-900 [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {full ? (
            u.isStaff ? (
              <Panel title="Account controls">
                <p className="p-5 text-sm leading-6 text-ink-600">This person is on the team. To pause or delete the account, remove them in Team and access first.</p>
              </Panel>
            ) : (
              <>
                <Panel title={u.suspended ? "Paused" : "Pause"}>
                  <div className="p-5">
                    <SuspendControl userId={u.id} suspended={u.suspended} />
                  </div>
                </Panel>
                <Panel title="Delete account" className="border-flag-100">
                  <div className="p-5">
                    <DeleteControl userId={u.id} email={u.email} />
                  </div>
                </Panel>
              </>
            )
          ) : null}
        </div>
      </div>
    </>
  );
}
