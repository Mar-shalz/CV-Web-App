import { requireAdmin } from "@/lib/admin/auth";
import { listTeam } from "@/lib/admin/data";
import { revokeMember } from "@/app/admin/actions";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { AddMemberForm } from "@/components/admin/forms";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Team and access" };

export default async function AdminTeam() {
  const staff = await requireAdmin("team");
  const rows = await listTeam(staff);

  return (
    <>
      <PageHeader title="Team and access" intro="Give each person the smallest role that covers their work. Everyone must use two factor sign in. Removing someone takes effect on their next page load." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Staff">
          <Table caption="Staff" head={["Email", "Role", "Added", "Status", ""]}>
            {rows.map((m) => (
              <tr key={m.userId}>
                <Td className="font-medium">{m.email}</Td>
                <Td>{ROLE_LABELS[m.role as AdminRole]?.label ?? m.role}</Td>
                <Td className="text-ink-500">{formatDate(m.added)}</Td>
                <Td>
                  <StatusPill status={m.revoked ? "none" : "good"} label={m.revoked ? "Removed" : "Active"} />
                </Td>
                <Td>
                  {!m.revoked && m.userId !== staff.id && m.role !== "owner" ? (
                    <form action={revokeMember}>
                      <input type="hidden" name="user_id" value={m.userId} />
                      <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-flag-700 hover:bg-flag-50">Remove</button>
                    </form>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Add someone">
          <AddMemberForm />
        </Panel>
      </div>
    </>
  );
}
