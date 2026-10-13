import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listAudit } from "@/lib/admin/data";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";

export const metadata = { title: "Audit log" };

const ACTIONS = ["view", "refund", "resolve", "dismiss", "publish", "add_member", "revoke_member", "mfa_verified"];
const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const staff = await requireAdmin("audit");
  const { action } = await searchParams;
  const filter = ACTIONS.includes(action ?? "") ? action : undefined;
  const rows = await listAudit(staff, filter);

  return (
    <>
      <PageHeader title="Audit log" intro="Every staff view of personal data and every change, newest first. Entries can't be edited or deleted from the app." />
      <nav aria-label="Filter by action" className="no-scrollbar flex gap-2 overflow-x-auto">
        {[undefined, ...ACTIONS].map((a) => (
          <Link
            key={a ?? "all"}
            href={a ? `/admin/audit?action=${a}` : "/admin/audit"}
            aria-current={filter === a ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium ${filter === a ? "bg-brand-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-150 hover:bg-ink-75"}`}
          >
            {a ? a.replace("_", " ") : "All"}
          </Link>
        ))}
      </nav>
      <Panel>
        <Table caption="Audit log" head={["When", "Who", "Action", "What"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-ink-500">{time(r.at)}</Td>
              <Td>
                {r.actor}
                {r.role ? <span className="block text-xs text-ink-500">{ROLE_LABELS[r.role as AdminRole]?.label ?? r.role}</span> : null}
              </Td>
              <Td className="font-medium capitalize">{r.action.replace("_", " ")}</Td>
              <Td className="font-mono text-[0.8125rem] text-ink-600">
                {r.entity}
                {r.entityId ? ` · ${r.entityId}` : ""}
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
