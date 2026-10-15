"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { addSkillFromCheck } from "@/app/(app)/experience/extras-actions";
import { Badge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import { ArrowDown2, Add, TickCircle } from "@/components/icons";

/**
 * The job and the advice stick to the top on laptops and tablets once you scroll, and
 * shrink to one compact band (founder, round 20). Children hide extra detail with
 * `lg:group-data-[stuck=true]/stick:hidden`.
 */
export function StickyTop({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div data-stuck={stuck} className="group/stick space-y-3 lg:sticky lg:top-0 lg:z-20 lg:-mx-8 lg:px-8 lg:data-[stuck=true]:space-y-2 lg:data-[stuck=true]:bg-[var(--app-bg)]/95 lg:data-[stuck=true]:pb-3 lg:data-[stuck=true]:pt-3 lg:data-[stuck=true]:shadow-[0_8px_16px_-12px_rgb(15_23_42/0.25)] lg:data-[stuck=true]:backdrop-blur-md">
        {children}
      </div>
    </>
  );
}

/** Long advice folds on phones with "See more" (founder, round 20). Wider screens show it all. */
export function SeeMore({ children, lines = 3 }: { children: ReactNode; lines?: 2 | 3 | 4 }) {
  const [open, setOpen] = useState(false);
  const clamp = { 2: "max-lg:line-clamp-2", 3: "max-lg:line-clamp-3", 4: "max-lg:line-clamp-4" }[lines];
  return (
    <div>
      <div className={open ? "" : clamp}>{children}</div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[0.8125rem] font-semibold text-brand-700 hover:underline lg:hidden" aria-expanded={open}>
        {open ? "See less" : "See more"}
      </button>
    </div>
  );
}

const REQ = { met: { label: "Met", tone: "proof" }, partly: { label: "Partly met", tone: "care" }, missing: { label: "Missing", tone: "neutral" } } as const;

/**
 * One requirement on the fit check. Closed by default on phones with its status always
 * showing; open on wider screens. When it isn't met, the person can add what they have
 * right here: kept apart on My Experience and used in their CV's Skills section (D-162).
 */
export function MatchItem({
  text,
  status,
  evidence,
  note,
  jobId,
  jobTitle,
  added: initialAdded,
}: {
  text: string;
  status: "met" | "partly" | "missing";
  evidence: string[];
  note: string | null;
  jobId: string;
  jobTitle: string | null;
  added: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [skill, setSkill] = useState("");
  const [detail, setDetail] = useState("");
  const [added, setAdded] = useState(initialAdded);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await addSkillFromCheck({ jobId, jobTitle, requirement: text, skill, note: detail });
      if (!res.ok) return setError(res.error);
      setAdded(res.added.skill);
      setAdding(false);
      setError(null);
      toast(`Added ${res.added.skill} to your skills.`);
    });
  const badge = added ? { label: "Added by you", tone: "brand" as const } : REQ[status];
  return (
    <li className="rounded-2xl bg-ink-50">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start justify-between gap-2 p-4 text-left lg:pointer-events-none">
        <span className="text-[0.9375rem] font-medium text-ink-900">{text}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <ArrowDown2 size={16} className={`text-ink-500 transition-transform lg:hidden ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div className={`${open ? "block" : "hidden"} px-4 pb-4 lg:block`}>
        {evidence.length ? (
          <ul className="space-y-1">
            {evidence.map((e) => (
              <li key={e} className="text-[0.8125rem] leading-5 text-ink-600">
                From your experience: <span className="text-ink-800">{e}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.8125rem] text-ink-600">Nothing in your experience covers this yet.</p>
        )}
        {note ? <p className="mt-1 text-xs text-care-700">{note}</p> : null}

        {added ? (
          <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-medium text-brand-800">
            <TickCircle size={16} variant="bulk" />
            You added {added}. It goes in the Skills section of your CV.
          </p>
        ) : status !== "met" ? (
          adding ? (
            <div className="mt-3 space-y-2 rounded-xl bg-white p-3 ring-1 ring-ink-150">
              <label htmlFor={`sk-${text}`} className="text-[0.8125rem] font-semibold text-ink-900">
                The skill or tool you have
              </label>
              <input id={`sk-${text}`} value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={60} placeholder="For example: Power BI" className={`${inputClass} text-sm`} />
              <label htmlFor={`dt-${text}`} className="block text-[0.8125rem] font-semibold text-ink-900">
                Where you used it <span className="font-normal text-ink-500">(optional, not on your CV)</span>
              </label>
              <input id={`dt-${text}`} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={240} placeholder="For example: monthly sales dashboards at NYSC" className={`${inputClass} text-sm`} />
              <p className="text-xs text-ink-500">Only add what&apos;s true: an interviewer may ask about it.</p>
              {error ? <p className="text-xs text-flag-700">{error}</p> : null}
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={busy || skill.trim().length < 2}>
                  Add to my skills
                </Button>
                <Button size="sm" variant="ghost" onClick={() => (setAdding(false), setError(null))}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-[0.8125rem] font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              <Add size={16} />I have this: add it
            </button>
          )
        ) : null}
      </div>
    </li>
  );
}

/** The match percentage as a ring (D-164). */
export function MatchRing({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const tone = pct >= 70 ? "text-proof-600" : pct >= 45 ? "text-care-600" : "text-ink-500";
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${pct}% match`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/80" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className={tone} />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums text-ink-900">{pct}%</span>
    </span>
  );
}
