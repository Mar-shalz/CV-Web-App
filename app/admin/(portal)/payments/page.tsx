import Link from "next/link";
import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { listPayments } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { RefundForm, FreeAccessForm, PricingForm } from "@/components/admin/forms";
import { getPricing } from "@/lib/pricing/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeFreeAccess } from "@/app/admin/actions";
import { formatDate, formatNaira } from "@/lib/format";
import { PRICES } from "@/lib/config";
import { PendingButton } from "@/components/ui/pending-button";

export const metadata = { title: "Payments" };

const STATUS = { active: "good", pending: "warn", failed: "bad", refunded: "none", expired: "none" } as const;
const PRODUCT: Record<string, string> = { job_hunt_30d: PRICES.products.job_hunt_30d.label, interview_boost: PRICES.products.interview_boost.label, free_access: "Free access" };

export default async function AdminPayments() {
  const staff = await requireAdmin("payments");
  const full = can(staff.role, "users.manage");
  const rows = await listPayments(staff, full);
  await logAdminAction(staff, "view", "passes");
  const canRefund = can(staff.role, "payments.refund");
  const canUsers = can(staff.role, "users");
  const total = rows.filter((r) => r.status === "active").reduce((s, r) => s + r.amountKobo, 0);
  type Free = { id: string; email: string; note: string | null; ends_at: string | null; created_at: string };
  let free: Free[] = [];
  if (!staff.preview) {
    const { data } = await createAdminClient().from("free_access").select("id, email, note, ends_at, created_at").is("revoked_at", null).order("created_at", { ascending: false }).limit(100);
    free = (data ?? []) as Free[];
  } else free = [{ id: "demo", email: "tester@example.com", note: "Tester", ends_at: null, created_at: "2026-10-13T09:00:00.000Z" }];

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
      <Panel title="Charging">
        <PricingForm initial={await getPricing()} canEdit={can(staff.role, "payments.pricing")} />
      </Panel>
      <Panel title="Free access for family and testers">
        <p className="px-5 pt-4 text-sm text-ink-600">They get everything a pass gives, without paying. It switches on when they sign in with this email, and ends on the date you choose.</p>
        <FreeAccessForm />
        {free.length ? (
          <Table caption="Free access" head={["Email", "Note", "Until", ""]}>
            {free.map((f) => (
              <tr key={f.id}>
                <Td className="font-medium text-ink-900">{f.email}</Td>
                <Td>{f.note ?? ""}</Td>
                <Td className="text-ink-500">{f.ends_at ? formatDate(f.ends_at) : "Until removed"}</Td>
                <Td>
                  <form action={revokeFreeAccess}>
                    <input type="hidden" name="id" value={f.id} />
                    <PendingButton pendingLabel="Removing" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-flag-700 hover:bg-flag-50">Remove</PendingButton>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}
      </Panel>
      <Panel title="All payments">
        <Table caption="Payments" head={["Who paid", "Reference", "Product", "Amount", "Status", "Date", canRefund ? "Refund" : ""]}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td className="font-medium [overflow-wrap:anywhere]">
                {canUsers ? (
                  <Link href={`/admin/users/${p.userId}`} className="hover:text-brand-700 hover:underline">
                    {p.email}
                  </Link>
                ) : (
                  p.email
                )}
              </Td>
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
