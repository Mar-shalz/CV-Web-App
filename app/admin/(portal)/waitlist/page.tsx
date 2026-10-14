import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { getWaitlist } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Waitlist" };

export default async function AdminWaitlist() {
  const staff = await requireAdmin("waitlist");
  const w = await getWaitlist(staff, can(staff.role, "users.manage"));
  await logAdminAction(staff, "view", "waitlist");
  const max = Math.max(1, ...w.bySource.map((s) => s.count));

  return (
    <>
      <PageHeader title="Waitlist" intro={`${w.total.toLocaleString("en-NG")} people. Gate 1 needs 300 sign ups and 3% clicking the price button.`} />
      <div className="grid gap-3 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Panel title="Where they came from">
          <ul className="space-y-3 p-5">
            {w.bySource.map((s) => (
              <li key={s.source}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-700">{s.source}</span>
                  <span className="font-semibold tabular-nums text-ink-900">{s.count}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-ink-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(s.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Latest sign ups">
          <Table caption="Latest waitlist sign ups" head={["Email", "Source", "Joined"]}>
            {w.rows.map((r, i) => (
              <tr key={i}>
                <Td className="font-medium">{r.email}</Td>
                <Td>{r.source}</Td>
                <Td className="text-ink-500">{formatDate(r.joined)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
