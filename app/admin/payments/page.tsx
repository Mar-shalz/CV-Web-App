import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { listPayments } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { RefundForm } from "@/components/admin/forms";
import { formatDate, formatNaira } from "@/lib/format";
import { PRICES } from "@/lib/config";

export const metadata = { title: "Payments" };

const STATUS = { active: "good", pending: "warn", failed: "bad", refunded: "none", expired: "none" } as const;
const PRODUCT: Record<string, string> = { job_hunt_30d: PRICES.products.job_hunt_30d.label, interview_boost: PRICES.products.interview_boost.label };

export default async function AdminPayments() {
  const staff = await requireAdmin("payments");
  const rows = await listPayments(staff);
  await logAdminAction(staff, "view", "passes");
  const canRefund = can(staff.role, "payments.refund");
  const total = rows.filter((r) => r.status === "active").reduce((s, r) => s + r.amountKobo, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        intro={`Only a verified Paystack webhook unlocks a pass. Refunds: within ${PRICES.refund_rule.within_days} days if fewer than ${PRICES.refund_rule.max_packed_applications + 1} applications were packed. Do the refund in Paystack, then record it here.`}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Active passes", value: rows.filter((r) => r.status === "active").length.toString() },
          { label: "Revenue from active passes", value: formatNaira(total) },
          { label: "Pending (transfer or USSD)", value: rows.filter((r) => r.status === "pending").length.toString() },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
            <p className="text-[0.8125rem] text-ink-500">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink-900">{k.value}</p>
          </div>
        ))}
      </section>
      <Panel title="All payments">
        <Table caption="Payments" head={["Reference", "Product", "Amount", "Status", "Date", canRefund ? "Refund" : ""]}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td className="font-mono text-[0.8125rem]">{p.reference}</Td>
              <Td>{PRODUCT[p.product] ?? p.product}</Td>
              <Td className="tabular-nums">{formatNaira(p.amountKobo)}</Td>
              <Td>
                <StatusPill status={STATUS[p.status as keyof typeof STATUS] ?? "none"} label={p.status[0]?.toUpperCase() + p.status.slice(1)} />
              </Td>
              <Td className="text-ink-500">{formatDate(p.created)}</Td>
              <Td>{canRefund && p.status === "active" ? <RefundForm passId={p.id} reference={p.reference} /> : null}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
