import { answerCheckIn } from "@/app/(app)/home/actions";
import type { HomeApplication } from "@/lib/home-data";
import { TickCircle, CloseCircle, Clock } from "@/components/icons";
import { formatDate } from "@/lib/format";

/** Batched check in: up to three applications on one card, one tap each. */
export function CheckInCard({ items }: { items: HomeApplication[] }) {
  if (items.length === 0) return null;
  return (
    <section id="checkins" aria-labelledby="checkin-title" className="scroll-mt-28 rounded-[var(--radius-card)] border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 lg:p-5">
      {/* Heading kept for screen readers; the founder wanted no visible title or bell here. */}
      <h2 id="checkin-title" className="sr-only">
        Heard back yet?
      </h2>
      <p className="text-sm font-medium text-ink-700">Any news on these applications? Tap one answer for each.</p>
      <ul className="stagger mt-2.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((a, i) => (
          <li key={a.id} style={{ ["--i" as string]: i }} className="rounded-xl border border-ink-150 bg-white p-3.5 shadow-card">
            <p className="truncate text-[0.9375rem] font-semibold text-ink-900">{a.title}</p>
            <p className="truncate text-[0.8125rem] text-ink-500">
              {a.employer}
              {a.sentAt ? ` · sent ${formatDate(a.sentAt)}` : ""}
            </p>
            <form action={answerCheckIn} className="mt-2.5 grid grid-cols-3 gap-2" aria-label={`Update ${a.title} at ${a.employer}`}>
              <input type="hidden" name="application_id" value={a.id} />
              <button name="answer" value="interview" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-proof-50 px-2 text-xs font-semibold text-proof-700 transition-colors hover:bg-proof-100">
                <TickCircle size={18} variant="bulk" />
                Invited
              </button>
              <button name="answer" value="rejected" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-ink-75 px-2 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100">
                <CloseCircle size={18} />
                Not this time
              </button>
              <button name="answer" value="nothing_yet" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-ink-75 px-2 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100">
                <Clock size={18} />
                No reply yet
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
