import type { TimelineEvent } from "@/lib/applications/data";
import { STATUS_LABELS } from "@/lib/rules/status-flow";
import { formatDate } from "@/lib/format";

const SOURCE: Record<string, string> = {
  tap: "You updated it",
  forwarded_email: "From their email",
  pasted_sms: "From their SMS",
  auto_30d: "Automatic after 30 days with no reply",
};

const GOOD = new Set(["assessment", "interview", "second_interview", "offer", "accepted"]);

/** Status history (screen 18). Append only, so this is the full story. */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return null;
  const list = [...events].reverse();
  return (
    <section aria-labelledby="timeline-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <h2 id="timeline-title" className="text-[0.9375rem] font-semibold text-ink-900">
        History
      </h2>
      <ol className="stagger mt-4">
        {list.map((e, i) => (
          <li key={`${e.at}-${e.to}`} style={{ ["--i" as string]: i }} className="relative flex gap-3 pb-5 last:pb-0">
            {i < list.length - 1 ? <span aria-hidden="true" className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-ink-150" /> : null}
            <span
              aria-hidden="true"
              className={`relative mt-1 size-[15px] shrink-0 rounded-full border-[3px] ${i === 0 ? (GOOD.has(e.to) ? "border-proof-500 bg-white ring-4 ring-proof-100" : "border-brand-500 bg-white ring-4 ring-brand-100") : "border-ink-300 bg-white"}`}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{STATUS_LABELS[e.to]}</p>
              <p className="text-xs text-ink-500">
                {formatDate(e.at)} · {SOURCE[e.source] ?? "Updated"}
              </p>
              {e.evidence ? <blockquote className="mt-1.5 border-l-2 border-ink-200 pl-2.5 text-[0.8125rem] leading-5 text-ink-600">&ldquo;{e.evidence}&rdquo;</blockquote> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
