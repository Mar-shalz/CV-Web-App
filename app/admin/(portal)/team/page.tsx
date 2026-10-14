import { requireAdmin } from "@/lib/admin/auth";
import { listTeam } from "@/lib/admin/data";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { AddMemberForm } from "@/components/admin/forms";
import { formatDate } from "@/lib/format";
import { TeamActions } from "@/components/admin/team-actions";

export const metadata = { title: "Team and Access" };

export default async function AdminTeam() {
  const staff = await requireAdmin("team");
  const rows = await listTeam(staff);

  return (
    <>
      <PageHeader title="Team and access" intro="Give each person the smallest role that covers their work. Everyone uses two factor sign in. Pause stops someone's back office access until you reactivate them; delete takes them off the team. Both take effect on their next page load." />
      <div className="grid items-start gap-3 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Staff">
          <Table caption="Staff" head={["Who", "Role", "Added", "Status", ""]}>
            {rows.map((m) => (
              <tr key={m.userId}>
                <Td>
                  <span className="block break-words font-medium text-ink-900">{m.name ?? m.email}</span>
                  {m.name ? <span className="block break-words text-xs text-ink-500">{m.email}</span> : null}
                </Td>
                <Td>{ROLE_LABELS[m.role as AdminRole]?.label ?? m.role}</Td>
                <Td className="whitespace-nowrap text-ink-500">{formatDate(m.added)}</Td>
                <Td>
                  <StatusPill status={m.status === "active" ? "good" : m.status === "paused" ? "warn" : "none"} label={m.status === "active" ? "Active" : m.status === "paused" ? "Paused" : "Removed"} />
                </Td>
                <Td className="text-right">
                  {m.userId === staff.id ? <span className="text-xs text-ink-500">You</span> : <TeamActions userId={m.userId} status={m.status} who={m.name ?? m.email} />}
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
