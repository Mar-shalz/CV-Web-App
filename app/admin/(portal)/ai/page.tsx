import { requireAdmin } from "@/lib/admin/auth";
import { getAi } from "@/lib/admin/data";
import { KpiCard, PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";

export const metadata = { title: "AI Cost and Quality" };

const usd = (n: number) => `$${n.toFixed(2)}`;
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const PROBLEM: Record<string, string> = {
  provider_error: "AI service error or no key",
  timeout: "Took too long",
  invalid_output: "Answer in the wrong shape",
  refusal: "AI declined",
  too_long: "Input too long",
  invalid_input: "Bad input",
};

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
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="AI keys on this server">
          <ul className="divide-y divide-ink-100">
            {a.providers.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium text-ink-900">{p.name}</span>
                <StatusPill status={p.ready ? "good" : "bad"} label={p.ready ? (p.position === 1 ? "Ready, tried first" : `Ready, tried ${p.position === 2 ? "second" : "later"}`) : "No key"} />
              </li>
            ))}
          </ul>
          {a.providers.every((p) => !p.ready) ? (
            <p className="border-t border-ink-100 px-5 py-3 text-sm text-flag-700">No AI key here, so CV upload, job checks and tailoring fail. Add GEMINI_API_KEY in Vercel, Settings, Environment Variables, then redeploy.</p>
          ) : null}
        </Panel>
        <Panel title="Recent problems">
          {a.problems.length ? (
            <ul className="divide-y divide-ink-100">
              {a.problems.map((p, i) => (
                <li key={`${p.at}-${i}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-mono text-[0.8125rem] text-ink-900">{p.task}</span>
                    <span className="block text-xs text-ink-500">
                      {p.model} · {when(p.at)}
                    </span>
                  </span>
                  <StatusPill status="bad" label={PROBLEM[p.outcome] ?? p.outcome} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-ink-500">No failed AI calls. Good.</p>
          )}
        </Panel>
      </div>
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
