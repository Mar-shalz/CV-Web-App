import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { endAnnouncement } from "@/app/admin/actions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { SendUpdateForm } from "@/components/admin/forms";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Messages to users" };

const AUDIENCE: Record<string, string> = { everyone: "Everyone", trial: "Free trial", pass: "Pass holders", no_pass: "No pass" };

// Read once per request on the server; kept out of render for the purity rule.
function nowMs() {
  return new Date().getTime();
}

type Row = { id: string; title: string; audience: string; starts_at: string; ends_at: string | null };

export default async function AdminMessages() {
  const staff = await requireAdmin("messages");
  let rows: Row[] = [];
  if (!staff.preview) {
    const { data } = await createAdminClient().from("announcements").select("id, title, audience, starts_at, ends_at").order("starts_at", { ascending: false }).limit(30);
    rows = (data ?? []) as Row[];
    await logAdminAction(staff, "view", "announcements");
  } else {
    rows = [{ id: "demo", title: "Graduate programme season is here", audience: "everyone", starts_at: "2026-10-12T09:00:00.000Z", ends_at: null }];
  }
  const now = nowMs();

  return (
    <>
      <PageHeader
        title="Messages to users"
        intro="Send an update to the Updates panel behind the bell: to everyone, to one group, or to one person. Payment receipts and pass and trial reminders go out on their own."
      />
      <Panel title="New message">
        <SendUpdateForm />
      </Panel>
      <Panel title="Sent to groups">
        <Table caption="Announcements" head={["Title", "Who", "Sent", "Status", ""]}>
          {rows.map((r) => {
            const live = !r.ends_at || new Date(r.ends_at).getTime() > now;
            return (
              <tr key={r.id}>
                <Td className="font-medium text-ink-900">{r.title}</Td>
                <Td>{AUDIENCE[r.audience] ?? r.audience}</Td>
                <Td className="text-ink-500">{formatDate(r.starts_at)}</Td>
                <Td>
                  <StatusPill status={live ? "good" : "none"} label={live ? (r.ends_at ? `Showing until ${formatDate(r.ends_at)}` : "Showing") : "Ended"} />
                </Td>
                <Td>
                  {live ? (
                    <form action={endAnnouncement}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-flag-700 hover:bg-flag-50">End now</button>
                    </form>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </>
  );
}
