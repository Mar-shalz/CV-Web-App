import { requireAdmin } from "@/lib/admin/auth";
import { getRules } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { publishRuleSet } from "@/app/admin/actions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { PendingButton } from "@/components/ui/pending-button";

export const metadata = { title: "Rules and Lists" };

export default async function AdminRules() {
  const staff = await requireAdmin("rules");
  const { rules, lists } = await getRules(staff);
  const canPublish = can(staff.role, "rules.publish");

  return (
    <>
      <PageHeader
        title="Rules and lists"
        intro="Eligibility rules and country formats are versioned data. A version needs a review before it can be published, and only the owner publishes. Lists are reviewed monthly."
      />
      <Panel title="Rule sets and country formats">
        <Table caption="Rule sets and country formats" head={["Type", "Version", "Reviewed", "Status", ""]}>
          {rules.map((r) => {
            const state = r.publishedAt ? "Published" : r.reviewedAt ? "Reviewed" : "Draft";
            return (
              <tr key={`${r.kind}-${r.version}`}>
                <Td>{r.kind}</Td>
                <Td className="font-mono text-[0.8125rem]">{r.version}</Td>
                <Td className="text-ink-500">{r.reviewedAt ? `${r.reviewedBy ?? "Reviewer"}, ${formatDate(r.reviewedAt)}` : "Not yet"}</Td>
                <Td>
                  <StatusPill status={r.publishedAt ? "good" : r.reviewedAt ? "warn" : "none"} label={state} />
                </Td>
                <Td>
                  {canPublish && r.reviewedAt && !r.publishedAt ? (
                    <form action={publishRuleSet}>
                      <input type="hidden" name="version" value={r.version} />
                      <input type="hidden" name="table" value={r.kind === "Country profile" ? "country_profiles" : "rule_sets"} />
                      <PendingButton pendingLabel="Publishing" className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Publish</PendingButton>
                    </form>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      <Panel title="Lists">
        <Table caption="Config lists" head={["List", "File", "Version", "Items", "Next review"]}>
          {lists.map((l) => (
            <tr key={l.file}>
              <Td className="font-medium">{l.name}</Td>
              <Td className="font-mono text-xs text-ink-500">{l.file}</Td>
              <Td>{l.version ?? <StatusPill status="none" label="Not created" />}</Td>
              <Td className="tabular-nums">{l.items ?? "None"}</Td>
              <Td className="text-ink-500">{l.nextReview ? formatDate(l.nextReview) : "Slice 4"}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
