import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listAudit, type AuditKind } from "@/lib/admin/data";
import { Avatar } from "@/components/shell/user-chip";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";

export const metadata = { title: "Audit Log" };

const KINDS: { id: AuditKind; label: string }[] = [
  { id: "actions", label: "Actions" },
  { id: "views", label: "Views of personal data" },
  { id: "sign_ins", label: "Sign ins" },
];
const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const staff = await requireAdmin("audit");
  const { show } = await searchParams;
  const kind = KINDS.find((k) => k.id === show)?.id ?? "actions";
  const rows = await listAudit(staff, kind);

  return (
    <>
      <PageHeader title="Audit log" intro="What the team did in the back office, newest first: who, what and to whom. Views of personal data are recorded too; see them under Views. Entries can't be edited or deleted." />
      <nav aria-label="Show" className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {KINDS.map((k) => (
          <Link
            key={k.id}
            href={k.id === "actions" ? "/admin/audit" : `/admin/audit?show=${k.id}`}
            aria-current={kind === k.id ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${kind === k.id ? "bg-brand-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-150 hover:bg-ink-75"}`}
          >
            {k.label}
          </Link>
        ))}
      </nav>
      <Panel>
        <Table caption="Audit log" head={["When", "Who", "Did", "To"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-ink-500">{time(r.at)}</Td>
              <Td>
                <span className="flex items-center gap-2.5">
                  <Avatar name={r.who} size={32} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-900">{r.who}</span>
                    <span className="block text-xs text-ink-500 [overflow-wrap:anywhere]">
                      {[r.whoEmail !== r.who ? r.whoEmail : null, r.role ? (ROLE_LABELS[r.role as AdminRole]?.label ?? r.role) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </span>
              </Td>
              <Td className="font-medium text-ink-900">{r.action}</Td>
              <Td className="text-ink-600 [overflow-wrap:anywhere]">{r.target ?? <span className="text-ink-400">None</span>}</Td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 ? <p className="p-6 text-center text-sm text-ink-500">Nothing here yet.</p> : null}
      </Panel>
    </>
  );
}
