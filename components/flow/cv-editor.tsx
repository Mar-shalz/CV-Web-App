"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { CvBullet, DEMO_CV } from "@/lib/demo/job";
import { Danger, DocumentDownload, Edit2, Trash, TickCircle, ArrowRight, InfoCircle, CloseCircle, Magicpen, Warning2 } from "@/components/icons";
import { Button } from "@/components/ui/button";

type Cv = typeof DEMO_CV;
type Resolution = "open" | "fixed" | "removed" | "kept";

/**
 * The tailored CV, shown as a page. Changed lines are highlighted and open to show
 * the user's own words. Lines the fact lock can't trace carry a warning with three
 * choices. Warnings never block the download.
 */
export function CvEditor({ cv, nextHref }: { cv: Cv; nextHref: string }) {
  const all = cv.roles.flatMap((r) => r.bullets);
  const [res, setRes] = useState<Record<string, Resolution>>(() => Object.fromEntries(all.filter((b) => b.flag).map((b) => [b.id, "open"])));
  const [open, setOpen] = useState<string | null>(null);
  const [original, setOriginal] = useState<Record<string, boolean>>({});
  const [downloaded, setDownloaded] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);

  const flagged = all.filter((b) => b.flag);
  const openFlags = flagged.filter((b) => res[b.id] === "open");
  const changed = all.filter((b) => b.change !== "kept").length;

  function resolve(id: string, r: Resolution) {
    setRes((cur) => ({ ...cur, [id]: r }));
  }
  function download() {
    if (openFlags.length) sheet.current?.showModal();
    else setDownloaded(true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* The page */}
      <article
        aria-label="Your tailored CV"
        className="min-w-0 rounded-[18px] border border-paper-edge bg-paper px-5 py-7 shadow-raised sm:px-10 sm:py-10"
        style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        <header className="border-b border-paper-edge pb-4 text-center">
          <h2 className="text-[1.5rem] font-bold tracking-tight text-ink-900">{cv.name}</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-600">{cv.contact}</p>
          <p className="mt-2 text-sm font-semibold text-brand-800">{cv.title}</p>
        </header>
        <CvSection title="Profile">
          <p className="text-sm leading-6 text-ink-800">{cv.summary}</p>
        </CvSection>
        {cv.sections.map((s) => (
          <CvSection key={s.heading} title={s.heading}>
            {s.lines.map((l) => (
              <p key={l} className="text-sm leading-6 text-ink-800">
                {l}
              </p>
            ))}
          </CvSection>
        ))}
        <CvSection title="Experience">
          <div className="space-y-5">
            {cv.roles.map((r) => (
              <div key={r.title}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-sm font-bold text-ink-900">
                    {r.title}, {r.org}
                  </p>
                  <p className="text-[0.8125rem] text-ink-600">{r.dates}</p>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {r.bullets
                    .filter((b) => res[b.id] !== "removed")
                    .map((b) => (
                      <Bullet
                        key={b.id}
                        b={b}
                        state={res[b.id]}
                        original={Boolean(original[b.id])}
                        open={open === b.id}
                        onToggle={() => setOpen(open === b.id ? null : b.id)}
                        onResolve={(r) => resolve(b.id, r)}
                        onOriginal={() => setOriginal((o) => ({ ...o, [b.id]: !o[b.id] }))}
                      />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </CvSection>
        <CvSection title="Skills">
          <p className="text-sm leading-6 text-ink-800">{cv.skills}</p>
        </CvSection>
        <CvSection title="Referees">
          <p className="text-sm leading-6 text-ink-800">Available on request</p>
        </CvSection>
      </article>

      {/* Side panel */}
      <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">What we changed</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
            <li className="flex items-center gap-2.5">
              <span className="h-4 w-6 rounded bg-brand-100" aria-hidden="true" />
              {changed} lines reworded to match the job
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-4 w-6 rounded bg-care-100" aria-hidden="true" />
              {flagged.length} lines need your check
            </li>
            <li className="flex items-center gap-2.5">
              <TickCircle size={20} variant="bulk" className="text-proof-600" />
              No employer, title, date or grade changed
            </li>
          </ul>
          <p className="mt-4 flex gap-2 rounded-2xl bg-ink-50 p-3 text-[0.8125rem] leading-5 text-ink-600">
            <InfoCircle size={18} className="mt-px shrink-0" />
            Tap any highlighted line to see the words it came from.
          </p>
        </section>

        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">Before you download</h2>
          {openFlags.length ? (
            <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-5 text-care-700">
              <Warning2 size={18} variant="bulk" className="mt-px shrink-0" />
              {openFlags.length} {openFlags.length === 1 ? "line needs" : "lines need"} a look. You can still download.
            </p>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-5 text-proof-700">
              <TickCircle size={18} variant="bulk" className="mt-px shrink-0" />
              Every line traces back to you.
            </p>
          )}
          <div className="mt-4 grid gap-2">
            <Button size="lg" onClick={download}>
              <DocumentDownload size={20} variant="bulk" />
              Download PDF
            </Button>
            <Button variant="secondary" onClick={download}>
              Download Word file
            </Button>
          </div>
          {downloaded ? (
            <div className="mt-4 animate-pop rounded-2xl bg-proof-50 p-3 text-[0.8125rem] text-proof-700" role="status">
              CV ready: Tolu_Adebayo_CV_Graduate_Trainee.pdf
            </div>
          ) : null}
          <Link href={nextHref} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Next: prepare your email
            <ArrowRight size={18} />
          </Link>
        </section>
      </aside>

      {/* Pre download check. Lists open flags; never blocks the download. */}
      <dialog
        ref={sheet}
        aria-labelledby="sheet-title"
        className="m-auto w-[min(92vw,480px)] rounded-[24px] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id="sheet-title" className="text-lg font-semibold text-ink-900">
              Check {openFlags.length === 1 ? "this line" : "these lines"} first?
            </h2>
            <button type="button" onClick={() => sheet.current?.close()} className="grid size-11 place-items-center rounded-xl text-ink-500 hover:bg-ink-75" aria-label="Close">
              <CloseCircle size={22} />
            </button>
          </div>
          <p className="mt-1 text-sm text-ink-600">An interviewer could ask about any line. Make sure you can explain each one.</p>
          <ul className="mt-4 space-y-2.5">
            {openFlags.map((b) => (
              <li key={b.id} className="rounded-2xl bg-care-50 p-3.5 text-[0.8125rem] leading-5 text-care-700">
                <p className="font-semibold text-ink-900">{b.text}</p>
                <p className="mt-1">{b.flag?.message}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => sheet.current?.close()}>
              Fix them first
            </Button>
            <Button
              onClick={() => {
                sheet.current?.close();
                setDownloaded(true);
              }}
            >
              Download anyway
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function CvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 border-b border-paper-edge pb-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-700">{title}</h3>
      {children}
    </section>
  );
}

function Bullet({
  b,
  state,
  original,
  open,
  onToggle,
  onResolve,
  onOriginal,
}: {
  b: CvBullet;
  state?: Resolution;
  original: boolean;
  open: boolean;
  onToggle: () => void;
  onResolve: (r: Resolution) => void;
  onOriginal: () => void;
}) {
  const flagged = b.flag && state === "open";
  const changed = b.change !== "kept" && !original;
  const text = original ? b.source.replace(/^"|"$/g, "") : b.text;
  const panel = `src-${b.id}`;
  return (
    <li className="text-sm leading-6 text-ink-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panel}
        className={`group flex w-full items-start gap-2 rounded-lg px-1.5 py-0.5 text-left transition-colors ${
          flagged ? "bg-care-100/70 hover:bg-care-100" : changed ? "bg-brand-50 hover:bg-brand-100" : "hover:bg-ink-75"
        }`}
      >
        <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-700" aria-hidden="true" />
        <span className="flex-1">
          {text}
          {flagged ? (
            <span className="ml-1.5 inline-flex translate-y-0.5 items-center text-care-700">
              <Danger size={16} variant="bulk" />
              <span className="sr-only"> Needs your check.</span>
            </span>
          ) : null}
          {changed && !flagged ? <span className="sr-only"> Reworded. Show source.</span> : null}
        </span>
      </button>
      {open ? (
        <div id={panel} className="my-2 ml-4 animate-rise rounded-2xl border border-ink-150 bg-white p-3.5 font-[family-name:var(--font-sans)] shadow-card">
          {flagged ? <p className="mb-2 flex items-start gap-2 text-[0.8125rem] font-semibold leading-5 text-care-700">{b.flag?.message}</p> : null}
          <p className="text-xs font-medium text-ink-500">From your own words</p>
          <p className="mt-0.5 text-[0.8125rem] italic leading-5 text-ink-700">{b.source}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {flagged ? (
              <>
                <SmallAction icon={<Edit2 size={16} />} onClick={() => onResolve("fixed")}>
                  {b.flag?.type === "number" ? "Add the real figure" : "Change to helped"}
                </SmallAction>
                <SmallAction icon={<Trash size={16} />} onClick={() => onResolve("removed")}>
                  Remove it
                </SmallAction>
                <SmallAction icon={<TickCircle size={16} />} onClick={() => onResolve("kept")}>
                  Keep it
                </SmallAction>
              </>
            ) : (
              <SmallAction icon={<Magicpen size={16} />} onClick={onOriginal}>
                {original ? "Use the tailored line" : "Use my original wording"}
              </SmallAction>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function SmallAction({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-ink-75 px-3 text-[0.8125rem] font-semibold text-ink-800 hover:bg-ink-100">
      {icon}
      {children}
    </button>
  );
}
