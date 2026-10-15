"use client";

import { StylePicker, useCvStyle } from "./style-picker";
import { CV_STYLE_INFO } from "@/lib/cv/styles";
import { ModalHeader } from "@/components/ui/modal-header";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { editCv, type CvOp } from "@/app/(app)/jobs/[id]/cv/actions";
import { answerSurvey } from "@/app/(app)/jobs/[id]/check/actions";
import type { CvBullet, CvDoc } from "@/lib/cv/types";
import { openFlags } from "@/lib/cv/types";
import { findBullet, updateBullet } from "@/lib/cv/ops";
import { Danger, DocumentDownload, Edit2, Trash, TickCircle, ArrowRight, InfoCircle, Magicpen, Warning2, Lock1 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

/**
 * The tailored CV as a page. Changed lines are highlighted and open to show the
 * person's own words. Lines the fact lock couldn't trace carry a warning with three
 * choices. Warnings never block the download.
 */
/** jobId is empty for the general CV from My Experience (D-143): no email pack follows it. */
export function CvEditor({ cvId: initialId, doc: initial, jobId, preview, dobToggle }: { cvId: string; doc: CvDoc; jobId?: string; preview: boolean; dobToggle: boolean }) {
  const [style, setStyle] = useCvStyle();
  const [doc, setDoc] = useState(initial);
  const [cvId, setCvId] = useState(initialId);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [askVault, setAskVault] = useState<{ bulletId: string; facts: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [survey, setSurvey] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const sheet = useRef<HTMLDialogElement>(null);
  const pendingType = useRef<"pdf" | "docx">("pdf");

  const bullets = doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets) : []));
  const flagged = bullets.filter((b) => b.flags.some((f) => f.status === "open"));
  const changed = bullets.filter((b) => b.rewriteType !== "kept").length;
  const openCount = openFlags(doc);

  function run(op: CvOp, local: (d: CvDoc) => CvDoc) {
    setError(null);
    start(async () => {
      const res = await editCv(cvId, op);
      if (res.ok) {
        setDoc(res.doc);
        setCvId(res.cvId);
        if (op.kind === "edit" && res.newFacts.length) setAskVault({ bulletId: op.bulletId, facts: res.newFacts });
      } else if (res.error === "preview" || preview) {
        setDoc(local);
      } else setError(res.error);
    });
  }

  const resolve = (b: CvBullet, action: "removed" | "kept") =>
    run({ kind: "resolve", bulletId: b.id, action }, (d) => (action === "removed" ? updateBullet(d, b.id, () => null) : updateBullet(d, b.id, (x) => ({ ...x, flags: x.flags.map((f) => ({ ...f, status: "kept" as const })) }))));
  const revertToOriginal = (b: CvBullet) => run({ kind: "original", bulletId: b.id }, (d) => updateBullet(d, b.id, (x) => ({ ...x, text: x.original, rewriteType: "kept", flags: [] })));
  const saveEdit = (b: CvBullet) => {
    run({ kind: "edit", bulletId: b.id, text: draft }, (d) => updateBullet(d, b.id, (x) => ({ ...x, text: draft, rewriteType: "reworded", flags: [] })));
    setEditing(null);
  };

  function download(type: "pdf" | "docx", force = false) {
    if (openCount && !force) {
      pendingType.current = type;
      sheet.current?.showModal();
      return;
    }
    // A file download from our own route; an anchor keeps the CV screen open.
    const a = document.createElement("a");
    a.href = `/api/cv/${cvId}/export?type=${type}&style=${style}`;
    a.rel = "noopener";
    a.click();
    setDownloaded(true);
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <article aria-label="Your tailored CV" className="min-w-0 rounded-[18px] border border-paper-edge bg-paper px-5 py-7 shadow-raised sm:px-10 sm:py-10" style={{ fontFamily: CV_STYLE_INFO[style].css }}>
        {/* The preview follows the chosen design (D-142). */}
        <header
          className={
            style === "signature"
              ? "-mx-5 -mt-7 mb-2 rounded-t-[18px] border-b-4 border-[#0a7878] bg-[#0a3340] px-5 pb-5 pt-6 text-left sm:-mx-10 sm:-mt-10 sm:px-10"
              : style === "modern"
                ? "pb-4 text-left"
                : `pb-4 text-center ${style === "executive" ? "border-b-4 border-double border-ink-900" : "border-b-2 border-brand-900"}`
          }
        >
          <h2 className={style === "signature" ? "text-[2rem] font-bold text-white" : style === "modern" ? "text-[2rem] font-bold text-brand-600" : "text-[1.75rem] font-bold uppercase tracking-[0.06em] text-ink-900"}>{doc.name}</h2>
          {doc.titleLine ? (
            <p className={`mt-1 inline-block rounded px-1 text-[0.9375rem] font-semibold ${style === "signature" ? "text-[#bde6e6]" : "text-brand-800"} ${doc.titleFlags.some((f) => f.status === "open") ? "bg-care-100 text-care-800" : ""}`}>{doc.titleLine}</p>
          ) : null}
          <p className={`mt-2 text-[0.8125rem] ${style === "signature" ? "text-white/80" : "text-ink-600"}`}>{doc.contactLine.split(" · ").join("  |  ")}</p>
          {doc.include.date_of_birth ? <p className="text-[0.8125rem] text-ink-600">Date of birth: added at download</p> : null}
        </header>
        {doc.summary.text ? (
          <CvSectionBlock title={doc.format === "uk" ? "Profile" : "Profile summary"}>
            <p className={`rounded px-1 text-sm leading-6 text-ink-800 ${doc.summary.flags.some((f) => f.status === "open") ? "bg-care-100/70" : ""}`}>{doc.summary.text}</p>
            {doc.summary.flags.filter((f) => f.status === "open").map((f) => (
              <p key={f.token} className="mt-1 px-1 font-[family-name:var(--font-sans)] text-xs text-care-700">
                {f.message} (&ldquo;{f.token}&rdquo;)
              </p>
            ))}
          </CvSectionBlock>
        ) : null}
        {doc.sections.map((s) => (
          <CvSectionBlock key={s.key} title={s.heading}>
            {s.kind === "lines" ? (
              <div className="space-y-1">
                {s.lines.map((l) => {
                  const at = l.indexOf(": ");
                  return (
                    <p key={l} className="text-sm leading-6 text-ink-800">
                      {at > 0 && at < 30 ? (
                        <>
                          <span className="font-bold text-ink-900">{l.slice(0, at)}:</span> {l.slice(at + 2)}
                        </>
                      ) : (
                        l
                      )}
                    </p>
                  );
                })}
              </div>
            ) : s.kind === "entries" ? (
              <div className="space-y-3">
                {s.entries.map((e) => (
                  <div key={`${e.title}-${e.dates}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <p className="text-sm font-bold text-ink-900">{e.title}</p>
                      {e.dates ? <p className="text-[0.8125rem] text-ink-600">{e.dates}</p> : null}
                    </div>
                    {e.subtitle ? <p className="text-[0.8125rem] italic text-ink-600">{e.subtitle}</p> : null}
                    {e.detail ? <p className="text-[0.8125rem] text-ink-800">{e.detail}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {s.roles.map((r) => (
                  <div key={r.roleId}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <p className="text-sm font-bold text-ink-900">{r.title}</p>
                      <p className="text-[0.8125rem] text-ink-600">{r.dates}</p>
                    </div>
                    {r.organisation || r.location ? <p className="text-[0.8125rem] italic text-ink-600">{[r.organisation, r.location].filter(Boolean).join(", ")}</p> : null}
                    <ul className="mt-2 space-y-1.5">
                      {r.bullets.map((b) => {
                        const isOpen = open === b.id;
                        const flags = b.flags.filter((f) => f.status === "open");
                        const flaggedLine = flags.length > 0;
                        return (
                          <li key={b.id} className="text-sm leading-6 text-ink-800">
                            <button
                              type="button"
                              onClick={() => setOpen(isOpen ? null : b.id)}
                              aria-expanded={isOpen}
                              className={`flex w-full items-start gap-2 rounded-lg px-1.5 py-0.5 text-left transition-colors ${flaggedLine ? "bg-care-100/70 hover:bg-care-100" : b.rewriteType !== "kept" ? "bg-brand-50 hover:bg-brand-100" : "hover:bg-ink-75"}`}
                            >
                              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-700" aria-hidden="true" />
                              <span className="flex-1">
                                {b.text}
                                {flaggedLine ? (
                                  <span className="ml-1.5 inline-flex translate-y-0.5 text-care-700">
                                    <Danger size={16} variant="bulk" />
                                    <span className="sr-only"> Needs your check.</span>
                                  </span>
                                ) : null}
                              </span>
                            </button>
                            {isOpen ? (
                              <div className="my-2 ml-4 animate-rise rounded-2xl border border-ink-150 bg-white p-3.5 font-[family-name:var(--font-sans)] shadow-card">
                                {flags.map((f) => (
                                  <p key={f.type + f.token} className="mb-1.5 text-[0.8125rem] font-semibold leading-5 text-care-700">
                                    {f.message}
                                  </p>
                                ))}
                                <p className="text-xs font-medium text-ink-500">From your own words</p>
                                <p className="mt-0.5 text-[0.8125rem] italic leading-5 text-ink-700">&ldquo;{b.sourceQuote ?? b.original}&rdquo;</p>
                                {editing === b.id ? (
                                  <div className="mt-3 space-y-2">
                                    <label htmlFor={`e-${b.id}`} className="sr-only">
                                      Edit this line
                                    </label>
                                    <textarea id={`e-${b.id}`} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputClass} py-2.5 text-sm leading-6`} />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => saveEdit(b)} disabled={busy || draft.trim().length < 5}>
                                        Save line
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {flaggedLine ? (
                                      <>
                                        <Small icon={<Edit2 size={16} />} onClick={() => { setEditing(b.id); setDraft(b.text); }}>
                                          Add the real detail
                                        </Small>
                                        <Small icon={<Trash size={16} />} onClick={() => resolve(b, "removed")}>
                                          Remove it
                                        </Small>
                                        <Small icon={<TickCircle size={16} />} onClick={() => resolve(b, "kept")}>
                                          Keep it
                                        </Small>
                                      </>
                                    ) : (
                                      <>
                                        <Small icon={<Edit2 size={16} />} onClick={() => { setEditing(b.id); setDraft(b.text); }}>
                                          Edit
                                        </Small>
                                        {b.rewriteType !== "kept" ? (
                                          <Small icon={<Magicpen size={16} />} onClick={() => revertToOriginal(b)}>
                                            Use my original wording
                                          </Small>
                                        ) : null}
                                      </>
                                    )}
                                  </div>
                                )}
                                <p className="mt-2 text-xs text-ink-500">Could you explain this line in an interview, with an example?</p>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CvSectionBlock>
        ))}
      </article>

      <aside className="space-y-3 xl:sticky xl:top-28 xl:self-start">
        {error ? (
          <p role="alert" className="rounded-2xl bg-flag-50 p-3 text-sm text-flag-700">
            {error}
          </p>
        ) : null}
        {askVault ? (
          <section className="animate-pop rounded-[var(--radius-card)] border border-brand-100 bg-brand-50 p-4" aria-live="polite">
            <p className="text-sm font-semibold text-ink-900">Add this to your experience?</p>
            <p className="mt-1 text-[0.8125rem] text-ink-600">Your line now has {askVault.facts.map((f) => `“${f}”`).join(", ")}, which isn&apos;t in your experience yet. If it&apos;s true, add it so it isn&apos;t flagged again.</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  run({ kind: "vault", bulletId: askVault.bulletId }, (d) => updateBullet(d, askVault.bulletId, (x) => ({ ...x, flags: [] })));
                  setAskVault(null);
                }}
              >
                Yes, it&apos;s true
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAskVault(null)}>
                Not now
              </Button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">What We Changed</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
            <li className="flex items-center gap-2.5">
              <span className="h-4 w-6 rounded bg-brand-100" aria-hidden="true" />
              {changed} {changed === 1 ? "line" : "lines"} reworded to match the job
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-4 w-6 rounded bg-care-100" aria-hidden="true" />
              {flagged.length} {flagged.length === 1 ? "line needs" : "lines need"} your check
            </li>
            <li className="flex items-center gap-2.5">
              <TickCircle size={20} variant="bulk" className="text-proof-600" />
              Employers, titles, dates and grades come straight from your records
            </li>
          </ul>
          <p className="mt-4 flex gap-2 rounded-2xl bg-ink-50 p-3 text-[0.8125rem] leading-5 text-ink-600">
            <InfoCircle size={18} className="mt-px shrink-0" />
            Tap any line to see the words it came from.
          </p>
        </section>

        {dobToggle ? (
          <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  <Lock1 size={16} />
                  Add my date of birth to this CV
                </span>
                <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-600">This job asks for it. It goes on this CV only, and only if you switch it on.</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={doc.include.date_of_birth}
                onChange={(e) => run({ kind: "include", field: "date_of_birth", on: e.target.checked }, (d) => ({ ...d, include: { ...d.include, date_of_birth: e.target.checked } }))}
                className="mt-1 size-5 accent-brand-600"
              />
            </label>
          </section>
        ) : null}

        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">Before you Download</h2>
          {openCount ? (
            <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-5 text-care-700">
              <Warning2 size={18} variant="bulk" className="mt-px shrink-0" />
              {openCount} {openCount === 1 ? "line needs" : "lines need"} a look. You can still download.
            </p>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-5 text-proof-700">
              <TickCircle size={18} variant="bulk" className="mt-px shrink-0" />
              Every line traces back to you.
            </p>
          )}
          <div className="mt-4">
            <StylePicker value={style} onChange={setStyle} />
          </div>
          <div className="mt-4 grid gap-2">
            <Button size="lg" onClick={() => download("pdf")} disabled={busy}>
              <DocumentDownload size={20} variant="bulk" />
              Download PDF
            </Button>
            <Button variant="secondary" onClick={() => download("docx")} disabled={busy}>
              Download Word file
            </Button>
          </div>
          {downloaded && !survey ? (
            <div className="mt-4 animate-pop rounded-2xl bg-ink-50 p-3.5" aria-live="polite">
              <p className="text-sm font-semibold text-ink-900">Would you send this as it is?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ["yes", "Yes"],
                  ["small_edits", "With small edits"],
                  ["no", "No"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setSurvey(v!);
                      void answerSurvey({ survey: "send_as_is", answer: v as "yes" | "no" | "small_edits", ...(jobId ? { job_id: jobId } : {}) });
                    }}
                    className="min-h-11 rounded-xl bg-white px-3 text-sm font-semibold text-ink-700 ring-1 ring-ink-150 hover:bg-ink-75"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ) : survey ? (
            <p className="mt-4 text-[0.8125rem] text-proof-700">Thanks for telling us.</p>
          ) : null}
          {jobId ? (
            <Link href={`/jobs/${jobId}/pack`} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-brand-700 hover:bg-brand-50">
              Next: prepare your email
              <ArrowRight size={18} />
            </Link>
          ) : null}
        </section>
      </aside>

      <dialog ref={sheet} aria-labelledby="sheet-title" className="m-auto w-[min(92vw,520px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
        <ModalHeader id="sheet-title" title={`Check ${flagged.length === 1 ? "this line" : "these lines"} first?`} description="An interviewer could ask about any line. Make sure you can explain each one." onClose={() => sheet.current?.close()} />
        <div className="px-5 pb-6 sm:px-7">
          <ul className="mt-4 max-h-[50vh] space-y-2.5 overflow-y-auto">
            {flagged.map((b) => (
              <li key={b.id} className="rounded-2xl bg-care-50 p-3.5 text-[0.8125rem] leading-5 text-care-700">
                <p className="font-semibold text-ink-900">{b.text}</p>
                <p className="mt-1">{b.flags.find((f) => f.status === "open")?.message}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => {
                sheet.current?.close();
                const first = flagged[0];
                if (first && findBullet(doc, first.id)) setOpen(first.id);
              }}
            >
              Fix them first
            </Button>
            <Button
              onClick={() => {
                sheet.current?.close();
                download(pendingType.current, true);
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

function CvSectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2.5 border-b border-ink-300 pb-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-900">{title}</h3>
      {children}
    </section>
  );
}

function Small({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-ink-75 px-3 text-[0.8125rem] font-semibold text-ink-800 hover:bg-ink-100">
      {icon}
      {children}
    </button>
  );
}
