import Link from "next/link";
import { TickCircle } from "@/components/icons";

const STEPS = [
  { key: "add", label: "Add the job" },
  { key: "check", label: "Check the fit" },
  { key: "cv", label: "Your tailored CV" },
  { key: "send", label: "Send it" },
] as const;

export type FlowStep = (typeof STEPS)[number]["key"];

/** Progress across the four steps of tailoring a CV to a job. */
export function FlowSteps({ current, hrefs = {} }: { current: FlowStep; hrefs?: Partial<Record<FlowStep, string>> }) {
  const at = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Progress">
      <ol className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, i) => {
          const done = i < at;
          const now = i === at;
          const href = done ? hrefs[s.key] : undefined;
          const body = (
            <>
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors ${
                  now ? "bg-brand-600 text-white shadow-[var(--shadow-cta)]" : done ? "bg-proof-600 text-white" : "bg-ink-150 text-ink-500"
                }`}
              >
                {done ? <TickCircle size={16} variant="bulk" /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-sm ${now ? "font-semibold text-ink-900" : done ? "font-medium text-ink-700" : "text-ink-500"}`}>{s.label}</span>
              <span className="sr-only">{now ? ", current step" : done ? ", done" : ""}</span>
            </>
          );
          return (
            <li key={s.key} className="relative flex shrink-0 items-center gap-2" aria-current={now ? "step" : undefined}>
              {href ? (
                <Link href={href} className="flex min-h-10 items-center gap-2 rounded-full pr-2 hover:bg-ink-75">
                  {body}
                </Link>
              ) : (
                <span className="flex min-h-10 items-center gap-2 pr-2">{body}</span>
              )}
              {i < STEPS.length - 1 ? <span className={`h-px w-6 shrink-0 sm:w-10 ${i < at ? "bg-proof-600" : "bg-ink-200"}`} aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
