import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { getCompanies } from "@/lib/admin/companies";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { inputClass } from "@/components/ui/field";
import { LIMITS } from "@/lib/config";

export const metadata = { title: "Companies" };

const EXISTS = { yes: "Found", no: "No trace", unknown: "Not sure" } as const;

/** What job checks have learned about each employer, and what our own records saved (D-200). */
export default async function AdminCompanies({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireAdmin("companies");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const c = await getCompanies(staff, q);
  await logAdminAction(staff, "view", "companies");

  return (
    <>
      <PageHeader
        title="Companies"
        intro={`Every job check adds what it learned about the employer. The next check of that employer starts here for ${LIMITS.legitimacy.cache_days_employer} days, and the same web search is reused for ${LIMITS.search.cache_days} days, so we pay for each once.`}
      />
      {!c.ready ? (
        <Panel>
          <p className="p-5 text-sm text-ink-600">Run section 25 of the database update to start keeping company records.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Companies on record", c.total.toLocaleString("en-NG"), "Each one checked at least once."],
              ["Web searches saved", c.searchesSaved.toLocaleString("en-NG"), `Answered from our records instead of paid search. ${c.searchesStored.toLocaleString("en-NG")} searches kept.`],
              ["AI readings saved", c.readsSaved.toLocaleString("en-NG"), "Search results the AI had already read, reused."],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
                <p className="text-[0.8125rem] text-ink-500">{label}</p>
                <p className="mt-1 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-ink-900">{value}</p>
                <p className="mt-1 text-xs leading-5 text-ink-500">{note}</p>
              </div>
            ))}
          </div>
          <Panel
            title="Company records"
            action={
              <form className="flex gap-2" role="search">
                <label htmlFor="company-q" className="sr-only">
                  Search companies
                </label>
                <input id="company-q" name="q" defaultValue={q} placeholder="Search by name" className={`${inputClass} h-10 w-48`} />
              </form>
            }
          >
            <Table caption="Companies job checks have looked up" head={["Company", "Website", "Exists", "Started", "Checks", "Posts with red flags", "Last looked up"]}>
              {c.rows.map((r) => (
                <tr key={r.name}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td>{r.website ?? "Not known"}</Td>
                  <Td>{EXISTS[r.exists]}</Td>
                  <Td>{r.founded ?? "Not known"}</Td>
                  <Td className="tabular-nums">{r.checks}</Td>
                  <Td className="tabular-nums">{r.redFlagPosts}</Td>
                  <Td className="text-ink-500">{formatDate(r.checkedAt)}</Td>
                </tr>
              ))}
            </Table>
            <p className="border-t border-ink-100 px-5 py-3 text-xs leading-5 text-ink-500">
              &ldquo;Posts with red flags&rdquo; counts job posts naming this company that had red flags. Scammers often use real companies&apos; names, so it is never a verdict on the company and is never shown to users.
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}
