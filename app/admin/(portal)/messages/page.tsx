import Link from "next/link";
import { requireAdmin, logAdminAction } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { messageHistory, getDraft, type SentMessage } from "@/lib/admin/messages";
import { recallMessage, deleteDraft } from "@/app/admin/actions";
import { PageHeader, Panel, StatusPill, Table, Td } from "@/components/admin/ui";
import { SendUpdateForm } from "@/components/admin/forms";
import { formatDate } from "@/lib/format";
import { PendingButton } from "@/components/ui/pending-button";
import { Edit2 } from "@/components/icons";

export const metadata = { title: "Messages to Users" };

const AUDIENCE: Record<string, string> = { everyone: "Everyone", trial: "Free trial", pass: "Pass holders", no_pass: "No pass", person: "One person" };

const STATE: Record<SentMessage["state"], { status: "good" | "warn" | "none" | "bad"; label: (m: SentMessage) => string }> = {
  showing: { status: "good", label: (m) => (m.until ? `Showing until ${formatDate(m.until)}` : "Showing") },
  ended: { status: "none", label: () => "Ended" },
  delivered: { status: "good", label: () => "Delivered, not read" },
  read: { status: "good", label: () => "Read" },
  recalled: { status: "none", label: () => "Recalled" },
};

export default async function AdminMessages({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const staff = await requireAdmin("messages");
  const { draft: draftId } = await searchParams;
  const full = can(staff.role, "users.manage");
  let drafts: Awaited<ReturnType<typeof messageHistory>>["drafts"] = [];
  let sent: SentMessage[] = [];
  let historyReady = true;
  let editing = null;
  if (!staff.preview) {
    [{ drafts, sent, historyReady }, editing] = await Promise.all([messageHistory(full), draftId ? getDraft(draftId) : Promise.resolve(null)]);
    await logAdminAction(staff, "view", "announcements");
  } else {
    sent = [
      { id: "demo", audience: "everyone", to: "everyone", title: "Graduate programme season is here", body: "Big banks open their graduate programmes this month. Check your CV and tailor it to each one.", link: "/jobs/new", sentAt: "2026-10-12T09:00:00.000Z", by: "Victor", state: "showing", until: null, canRecall: true },
      { id: "demo2", audience: "person", to: "to•••@gm•••.com", title: "Your CV is ready", body: "We fixed the problem with your upload. Try it again.", link: null, sentAt: "2026-10-11T09:00:00.000Z", by: "Victor", state: "read", until: null, canRecall: true },
    ];
  }

  return (
    <>
      <PageHeader
        title="Messages to users"
        intro="Send an update to the Updates panel behind the bell: to everyone, to one group, or to one person. Save it as a draft to finish later. Payment receipts and pass and trial reminders go out on their own."
      />
      <Panel title={editing ? "Edit draft" : "New message"}>
        <SendUpdateForm key={editing?.id ?? "new"} draft={editing} />
      </Panel>

      {drafts.length ? (
        <Panel title={`Drafts (${drafts.length})`}>
          <ul className="divide-y divide-ink-100">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{d.title}</p>
                  <p className="text-xs text-ink-500">
                    To {AUDIENCE[d.audience]?.toLowerCase() ?? d.audience} · Saved {formatDate(d.updatedAt)}
                  </p>
                </div>
                <Link href={`/admin/messages?draft=${d.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                  <Edit2 size={16} />
                  Open
                </Link>
                <form action={deleteDraft}>
                  <input type="hidden" name="id" value={d.id} />
                  <PendingButton pendingLabel="Deleting" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-flag-50 hover:text-flag-700">
                    Delete
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Sent Messages">
        {!historyReady ? (
          <p className="border-b border-ink-100 bg-care-50 px-5 py-2.5 text-xs text-care-700">Run the latest database update (GO_LIVE.md) to keep drafts and full history. Messages already sent still show below.</p>
        ) : null}
        {sent.length ? (
          <Table caption="Sent messages" head={["Title", "To", "Sent", "By", "Status", ""]}>
            {sent.map((m) => {
              const st = STATE[m.state];
              return (
                <tr key={m.id}>
                  <Td className="max-w-[28rem] text-ink-900">
                    {/* The message as people saw it, one tap away (founder, round 14). */}
                    <details className="group/msg">
                      <summary className="cursor-pointer list-none font-medium hover:text-brand-700 [&::-webkit-details-marker]:hidden">
                        {m.title}
                        <span className="ml-1.5 text-xs font-semibold text-brand-700 group-open/msg:hidden">Read</span>
                      </summary>
                      <div className="mt-2 rounded-xl bg-ink-50 p-3 text-[0.8125rem] leading-5 text-ink-700">
                        <p className="whitespace-pre-line">{m.body ?? "No message text."}</p>
                        {m.link ? <p className="mt-1.5 text-xs text-ink-500">Link: {m.link}</p> : null}
                      </div>
                    </details>
                  </Td>
                  <Td>{m.audience === "person" ? m.to : (AUDIENCE[m.audience] ?? m.audience)}</Td>
                  <Td className="text-ink-500">{formatDate(m.sentAt)}</Td>
                  <Td className="text-ink-500">{m.by ?? "Team"}</Td>
                  <Td>
                    <StatusPill status={st.status} label={st.label(m)} />
                  </Td>
                  <Td>
                    {m.canRecall ? (
                      <form action={recallMessage}>
                        <input type="hidden" name="id" value={m.id} />
                        <PendingButton pendingLabel="Recalling" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-flag-700 hover:bg-flag-50">
                          Recall
                        </PendingButton>
                      </form>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <p className="p-5 text-sm text-ink-500">Nothing sent yet.</p>
        )}
        <p className="border-t border-ink-100 px-5 py-2.5 text-xs leading-5 text-ink-500">Recall takes a message out of the app straight away. If someone already read it, they may remember it.</p>
      </Panel>
    </>
  );
}
