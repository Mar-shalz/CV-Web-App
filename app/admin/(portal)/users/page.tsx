import Link from "next/link";
import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { listUsers, type UserFilter } from "@/lib/admin/users";
import { PlanPill, lastSeen } from "@/components/admin/user-bits";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { formatDate, formatNaira } from "@/lib/format";
import { SearchNormal1, Lock1, ArrowRight2, TickCircle } from "@/components/icons";

export const metadata = { title: "Users" };

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "paying", label: "Pass now" },
  { id: "paid_ever", label: "Have paid" },
  { id: "active", label: "Active this week" },
  { id: "suspended", label: "Paused" },
];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; deleted?: string }> }) {
  const staff = await requireAdmin("users");
  const full = can(staff.role, "users.manage");
  const sp = await searchParams;
  const query = sp.q?.trim().toLowerCase().slice(0, 80) || undefined;
  const filter = (FILTERS.find((f) => f.id === sp.filter)?.id ?? "all") as UserFilter;
  const { rows, stats, note } = await listUsers(staff, { q: query, filter, full });
  await logAdminAction(staff, "view", "users", null, { searched: Boolean(query), filter, results: rows.length, full_emails: full });
  const href = (f: UserFilter) => `/admin/users?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(f !== "all" ? { filter: f } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Users"
        intro={full ? "Everyone with an account, newest first. Open a person to see their usage and payments, or to pause or delete the account." : "Accounts, newest first. Emails are masked. CVs, job posts and sensitive details are never shown here."}
      />

      {sp.deleted ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-proof-50 px-4 py-3 text-sm font-medium text-proof-700">
          <TickCircle size={18} variant="bulk" />
          Account deleted, with all its files.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Accounts", value: stats.total },
          { label: "With a pass now", value: stats.paying },
          { label: "Active in the last 7 days", value: stats.active7 },
          { label: "Joined in the last 7 days", value: stats.new7 },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
            <p className="text-[0.8125rem] text-ink-500">{k.label}</p>
            <p className="mt-1 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-ink-900 tabular-nums">{k.value.toLocaleString("en-NG")}</p>
          </div>
        ))}
      </div>

      <Panel>
        <div className="space-y-3 border-b border-ink-100 p-4">
          <form role="search" className="flex flex-wrap items-center gap-3">
            {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
            <label htmlFor="user-q" className="sr-only">
              {full ? "Find by email" : "Find by the start of an email"}
            </label>
            <div className="relative min-w-[240px] flex-1">
              <SearchNormal1 size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" />
              <input id="user-q" name="q" defaultValue={query} placeholder={full ? "Search by email" : "Start of an email, for a support request"} className="h-12 w-full rounded-2xl bg-ink-75 pl-11 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Lock1 size={14} />
              Searches are written to the audit log.
            </p>
          </form>
          <nav aria-label="Filter users" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={href(f.id)}
                aria-current={filter === f.id ? "page" : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${filter === f.id ? "bg-brand-900 text-white" : "bg-ink-75 text-ink-700 hover:bg-ink-100"}`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          {note ? <p className="text-xs text-care-700">{note}</p> : null}
        </div>
        <Table caption="Users" head={["Person", "Plan", "Paid", "Active days (30)", "Last active", "Joined", ""]}>
          {rows.map((u) => (
            <tr key={u.id} className={u.suspended ? "bg-flag-50/40" : undefined}>
              <Td>
                <Link href={`/admin/users/${u.id}`} className="block min-w-0 rounded-lg hover:text-brand-700">
                  <span className="block font-medium text-ink-900 [overflow-wrap:anywhere]">{u.email}</span>
                  <span className="block text-xs text-ink-500">
                    {u.name ?? "No name yet"}
                    {u.suspended ? " · Paused" : !u.setup ? " · Setup not finished" : ""}
                  </span>
                </Link>
              </Td>
              <Td>
                <PlanPill plan={u.plan} />
              </Td>
              <Td className="tabular-nums">{u.paidKobo ? formatNaira(u.paidKobo) : <span className="text-ink-400">None</span>}</Td>
              <Td className="tabular-nums">{u.activeDays30}</Td>
              <Td className="text-ink-600">{lastSeen(u.lastActive)}</Td>
              <Td className="text-ink-500">{formatDate(u.joined)}</Td>
              <Td>
                <Link href={`/admin/users/${u.id}`} aria-label={`Open ${u.email}`} className="grid size-10 place-items-center rounded-lg text-ink-500 hover:bg-ink-75 hover:text-brand-700">
                  <ArrowRight2 size={18} />
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 ? <p className="p-6 text-center text-sm text-ink-500">No users match.</p> : null}
      </Panel>
    </>
  );
}
