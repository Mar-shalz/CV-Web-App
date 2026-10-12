import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/data";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { SearchNormal1, Lock1 } from "@/components/icons";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireAdmin("users");
  const { q } = await searchParams;
  const query = q?.trim().toLowerCase().slice(0, 80);
  const rows = await listUsers(staff, query);
  await logAdminAction(staff, "view", "users", null, { searched: Boolean(query), results: rows.length });

  return (
    <>
      <PageHeader title="Users" intro="Accounts, newest first. Emails are masked. CVs, job posts and sensitive details are never shown here." />
      <Panel>
        <form role="search" className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <label htmlFor="user-q" className="sr-only">
            Find by the start of an email
          </label>
          <div className="relative min-w-[240px] flex-1">
            <SearchNormal1 size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" />
            <input id="user-q" name="q" defaultValue={query} placeholder="Start of an email, for a support request" className="h-12 w-full rounded-2xl bg-ink-75 pl-11 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <Lock1 size={14} />
            Searches are written to the audit log.
          </p>
        </form>
        <Table caption="Users" head={["Email", "Stage", "Applying in", "Set up", "Joined"]}>
          {rows.map((u) => (
            <tr key={u.id}>
              <Td className="font-medium">{u.email}</Td>
              <Td>{u.stage}</Td>
              <Td>{u.markets}</Td>
              <Td>
                <StatusPill status={u.setup ? "good" : "warn"} label={u.setup ? "Done" : "Not finished"} />
              </Td>
              <Td className="text-ink-500">{formatDate(u.joined)}</Td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 ? <p className="p-6 text-center text-sm text-ink-500">No users match.</p> : null}
      </Panel>
    </>
  );
}
