import { requireAdmin } from "@/lib/admin/auth";
import { getAi } from "@/lib/admin/data";
import { KpiCard, PageHeader, Panel, Table, Td } from "@/components/admin/ui";

export const metadata = { title: "AI cost and quality" };

const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function AdminAi() {
  const staff = await requireAdmin("ai");
  const a = await getAi(staff);
  const over = a.perActiveUsd > a.budgetUsd;

  return (
    <>
      <PageHeader title="AI cost and quality" intro="Every model call is logged with task, model, prompt version, tokens, cost and outcome. No prompt or answer text is stored. Last 30 days." />
      <section className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Total AI cost" value={usd(a.totalUsd)} target="Reviewed weekly" status="none" note="All tasks" />
        <KpiCard label="Active users" value={a.activeUsers.toLocaleString("en-NG")} target="Counted by hashed id" status="none" note="Used at least one AI step" />
        <KpiCard label="Cost per active user" value={usd(a.perActiveUsd)} target={`under ${usd(a.budgetUsd)}`} status={a.activeUsers ? (over ? "bad" : "good") : "none"} note={over ? "Over budget: check the biggest task" : "Within budget"} />
      </section>
      <Panel title="By task">
        <Table caption="AI cost by task" head={["Task", "Model", "Calls", "Failed", "Average time", "Cost"]}>
          {a.rows
            .sort((x, y) => y.costUsd - x.costUsd)
            .map((r) => (
              <tr key={`${r.task}-${r.model}`}>
                <Td className="font-mono text-[0.8125rem]">{r.task}</Td>
                <Td className="text-ink-600">{r.model}</Td>
                <Td className="tabular-nums">{r.calls.toLocaleString("en-NG")}</Td>
                <Td className="tabular-nums">
                  {r.failed} <span className="text-ink-500">({r.calls ? ((r.failed / r.calls) * 100).toFixed(1) : "0"}%)</span>
                </Td>
                <Td className="tabular-nums">{(r.avgLatencyMs / 1000).toFixed(1)}s</Td>
                <Td className="tabular-nums font-semibold">{usd(r.costUsd)}</Td>
              </tr>
            ))}
        </Table>
        {a.rows.length === 0 ? <p className="p-6 text-center text-sm text-ink-500">No AI calls logged yet.</p> : null}
      </Panel>
    </>
  );
}
