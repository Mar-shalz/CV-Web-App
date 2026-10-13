import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { getReviews } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { resolveReport } from "@/app/admin/actions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { LIMITS } from "@/lib/config";
import { PendingButton } from "@/components/ui/pending-button";

export const metadata = { title: "Truth reviews" };

export default async function AdminReviews() {
  const staff = await requireAdmin("reviews");
  const r = await getReviews(staff);
  await logAdminAction(staff, "view", "truth_reports");
  const canResolve = can(staff.role, "reviews.resolve");
  const sla = LIMITS.back_office.truth_report_sla_hours;

  return (
    <>
      <PageHeader title="Truth reviews" intro={`Users tap "This is not true" on a CV line. Each report gets a human answer within ${sla} hours. Fix the cause, not just the line.`} />
      <Panel title={`Open reports (${r.reports.length})`}>
        <ul className="divide-y divide-ink-100">
          {r.reports.map((rep) => {
            const hours = rep.ageHours;
            const late = hours >= sla;
            return (
              <li key={rep.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] text-ink-900">&ldquo;{rep.reason}&rdquo;</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    Reported {formatDate(rep.created)}
                    <StatusPill status={late ? "bad" : "warn"} label={late ? `${hours}h, past ${sla}h` : `${hours}h old`} />
                  </p>
                </div>
                {canResolve ? (
                  <form action={resolveReport} className="flex shrink-0 gap-2">
                    <input type="hidden" name="report_id" value={rep.id} />
                    <PendingButton name="outcome" value="resolved" pendingLabel="Saving" className="min-h-11 rounded-xl bg-proof-50 px-4 text-sm font-semibold text-proof-700 hover:bg-proof-100">
                      Fixed
                    </PendingButton>
                    <PendingButton name="outcome" value="dismissed" pendingLabel="Saving" className="min-h-11 rounded-xl bg-ink-75 px-4 text-sm font-semibold text-ink-700 hover:bg-ink-100">
                      Not an error
                    </PendingButton>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
        {r.reports.length === 0 ? <p className="p-6 text-center text-sm text-ink-500">No open reports.</p> : null}
      </Panel>
      <Panel title={`This week's CV sample (${LIMITS.back_office.weekly_cv_sample} at random)`}>
        <p className="px-5 pt-4 text-[0.8125rem] text-ink-600">Check each CV against its vault for invented facts, inflated ownership and banned phrases. Opening a CV is logged.</p>
        <Table caption="Weekly CV sample" head={["CV", "Format", "Created"]}>
          {r.sample.map((c) => (
            <tr key={c.id}>
              <Td className="font-mono text-[0.8125rem]">{c.id.slice(0, 8)}</Td>
              <Td>{c.format}</Td>
              <Td className="text-ink-500">{formatDate(c.created)}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
