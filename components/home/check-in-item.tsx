import { answerCheckIn } from "@/app/(app)/home/actions";
import type { HomeApplication } from "@/lib/home-data";
import { TickCircle, CloseCircle, Clock } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { PendingButton } from "@/components/ui/pending-button";

/** One application waiting for an update, with the three one tap answers. */
export function CheckInItem({ a }: { a: HomeApplication }) {
  return (
    <>
      <p className="truncate text-[0.9375rem] font-semibold text-ink-900">{a.title}</p>
      <p className="truncate text-[0.8125rem] text-ink-500">
        {a.employer}
        {a.sentAt ? ` · sent ${formatDate(a.sentAt)}` : ""}
      </p>
      <form action={answerCheckIn} className="mt-2.5 grid grid-cols-3 gap-2" aria-label={`Update ${a.title} at ${a.employer}`}>
        <input type="hidden" name="application_id" value={a.id} />
        <PendingButton name="answer" value="interview" pendingLabel="Saving" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-proof-50 px-2 text-xs font-semibold text-proof-700 transition-colors hover:bg-proof-100">
          <TickCircle size={18} variant="bulk" />
          Invited
        </PendingButton>
        <PendingButton name="answer" value="rejected" pendingLabel="Saving" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-ink-75 px-2 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100">
          <CloseCircle size={18} />
          Not this time
        </PendingButton>
        <PendingButton name="answer" value="nothing_yet" pendingLabel="Saving" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-ink-75 px-2 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100">
          <Clock size={18} />
          No reply yet
        </PendingButton>
      </form>
    </>
  );
}
