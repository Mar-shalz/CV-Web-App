"use client";

import { StylePicker, useCvStyle } from "./style-picker";
import { CV_STYLE_INFO } from "@/lib/cv/styles";
import { ModalHeader } from "@/components/ui/modal-header";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { editCv, type CvOp } from "@/app/(app)/jobs/[id]/cv/actions";
import { answerSurvey } from "@/app/(app)/jobs/[id]/check/actions";
import type { CvBullet, CvDoc } from "@/lib/cv/types";
import { openFlags, pendingSuggestions } from "@/lib/cv/types";
import { findBullet, updateBullet } from "@/lib/cv/ops";
import { Danger, DocumentDownload, Edit2, Trash, TickCircle, ArrowRight, ArrowDown2, InfoCircle, Magicpen, Warning2, Lock1, Sms, DocumentText } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

type FileType = "pdf" | "docx";

/**
 * The tailored CV as a page. Reworded lines and the summary are suggestions: they go in
 * the file only when the person accepts them (D-163). Lines the fact lock couldn't trace
 * carry a warning with three choices. Warnings never block the download.
 */
/** jobId is empty for the general CV from My Experience (D-143): no email pack follows it. */
export function CvEditor({ cvId: initialId, doc: initial, jobId, preview, dobToggle, title, subtitle }: { cvId: string; doc: CvDoc; jobId?: string; preview: boolean; dobToggle: boolean; title?: string; subtitle?: string }) {
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
  const pendingType = useRef<FileType>("pdf");

  const bullets = doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets) : []));
  const flagged = bullets.filter((b) => b.flags.some((f) => f.status === "open"));
  const changed = bullets.filter((b) => b.rewriteType !== "kept").length;
  const openCount = openFlags(doc);
  const pending = pendingSuggestions(doc);
  const toReview = openCount + pending.lines + (pending.summary ? 1 : 0);

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
  const revertToOriginal = (b: CvBullet) => run({ kind: "original", bulletId: b.id }, (d) => updateBullet(d, b.id, (x) => ({ ...x, text: x.original, rewriteType: "kept", flags: [], pending: false })));
  const accept = (b: CvBullet) => run({ kind: "accept", bulletId: b.id }, (d) => updateBullet(d, b.id, (x) => ({ ...x, pending: false })));
  const acceptAll = () =>
    run({ kind: "accept_all" }, (d) => ({ ...d, sections: d.sections.map((s) => (s.kind === "roles" ? { ...s, roles: s.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => ({ ...b, pending: false })) })) } : s)) }));
  const chooseSummary = (choice: "suggested" | "own" | "edit", text?: string) =>
    run({ kind: "summary", choice, text }, (d) => ({ ...d, summary: { ...d.summary, text: choice === "own" ? (d.summary.own ?? "") : choice === "edit" ? (text ?? d.summary.text) : d.summary.text, confirmed: true } }));
  const saveEdit = (b: CvBullet) => {
    run({ kind: "edit", bulletId: b.id, text: draft }, (d) => updateBullet(d, b.id, (x) => ({ ...x, text: draft, rewriteType: "reworded", flags: [], pending: false })));
    setEditing(null);
  };

  function download(type: FileType, force = false) {
    if (toReview && !force) {
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

  const nextHref = jobId ? `/jobs/${jobId}/pack` : null;

  return (
    <div className="space-y-3">
      {/* The header, its two buttons side by side, filled and sticky on laptops and tablets (founder, round 20). */}
      <div className="rounded-[var(--radius-card)] border border-ink-150 bg-white/95 p-4 shadow-card backdrop-blur-md lg:sticky lg:top-3 lg:z-20 lg:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[1.5rem] font-semibold leading-8 tracking-[-0.03em] text-ink-900 lg:text-[1.75rem] lg:leading-9">{title ?? "Your CV"}</h1>
            {subtitle ? <p className="mt-0.5 max-w-2xl text-[0.875rem] leading-6 text-ink-600">{subtitle}</p> : null}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
            <DownloadMenu onPick={(t) => download(t)} disabled={busy} />
            {nextHref ? <NextButton href={nextHref} strong={downloaded} /> : null}
          </div>
        </div>
      </div>

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
          {doc.summary.text || doc.summary.own ? (
            <CvSectionBlock title={doc.format === "uk" ? "Profile" : doc.format === "us" ? "Summary" : "Profile summary"}>
              <SummaryBlock doc={doc} busy={busy} onChoose={chooseSummary} />
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
                                className={`flex w-full items-start gap-2 rounded-lg px-1.5 py-0.5 text-left transition-colors ${flaggedLine ? "bg-care-100/70 hover:bg-care-100" : b.pending ? "bg-brand-50 ring-1 ring-brand-100 hover:bg-brand-100" : "hover:bg-ink-75"}`}
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
                              {/* A suggestion: accept it, or keep your own words, right here (D-163). */}
                              {b.pending && !flaggedLine && !isOpen ? (
                                <div className="ml-5 mt-1 flex flex-wrap items-center gap-1.5 font-[family-name:var(--font-sans)]">
                                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-brand-700">Suggested</span>
                                  <SuggestButton onClick={() => accept(b)} disabled={busy} tone="yes">
                                    <TickCircle size={14} variant="bulk" />
                                    Accept
                                  </SuggestButton>
                                  <SuggestButton onClick={() => revertToOriginal(b)} disabled={busy}>
                                    Keep my words
                                  </SuggestButton>
                                  <SuggestButton onClick={() => setOpen(b.id)} disabled={busy}>
                                    Compare
                                  </SuggestButton>
                                </div>
                              ) : null}
                              {isOpen ? (
                                <div className="my-2 ml-4 animate-rise rounded-2xl border border-ink-150 bg-white p-3.5 font-[family-name:var(--font-sans)] shadow-card">
                                  {flags.map((f) => (
                                    <p key={f.type + f.token} className="mb-1.5 text-[0.8125rem] font-semibold leading-5 text-care-700">
                                      {f.message}
                                    </p>
                                  ))}
                                  <p className="text-xs font-medium text-ink-500">{b.pending ? "Your words now" : "From your own words"}</p>
                                  <p className="mt-0.5 text-[0.8125rem] italic leading-5 text-ink-700">&ldquo;{b.pending ? b.original : (b.sourceQuote ?? b.original)}&rdquo;</p>
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
                                          <Small icon={<Edit2 size={16} />} onClick={() => (setEditing(b.id), setDraft(b.text))}>
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
                                          {b.pending ? (
                                            <Small icon={<TickCircle size={16} />} onClick={() => (accept(b), setOpen(null))}>
                                              Accept the suggestion
                                            </Small>
                                          ) : null}
                                          <Small icon={<Edit2 size={16} />} onClick={() => (setEditing(b.id), setDraft(b.text))}>
                                            Edit
                                          </Small>
                                          {b.rewriteType !== "kept" ? (
                                            <Small icon={<Magicpen size={16} />} onClick={() => revertToOriginal(b)}>
                                              Keep my words
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

        <aside className="space-y-3 xl:sticky xl:top-36 xl:self-start">
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

          {/* Before you download comes first now, then what we changed (founder, round 20). */}
          <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
            <h2 className="text-[0.9375rem] font-semibold text-ink-900">Before you Download</h2>
            {toReview ? (
              <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-5 text-care-700">
                <Warning2 size={18} variant="bulk" className="mt-px shrink-0" />
                {sentence([pending.summary ? "your summary to confirm" : null, pending.lines ? `${pending.lines} suggested ${pending.lines === 1 ? "line" : "lines"} to accept` : null, openCount ? `${openCount} ${openCount === 1 ? "line" : "lines"} to check` : null])}. You can still download: anything you haven&apos;t accepted goes in your own words.
              </p>
            ) : (
              <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-5 text-proof-700">
                <TickCircle size={18} variant="bulk" className="mt-px shrink-0" />
                Every line traces back to you, and you&apos;ve said yes to every change.
              </p>
            )}
            <div className="mt-4">
              <StylePicker value={style} onChange={setStyle} />
            </div>
            {/* Download CV lives in the header above (founder, round 21). */}
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
          </section>

          <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
            <h2 className="text-[0.9375rem] font-semibold text-ink-900">What We Changed</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
              <li className="flex items-center gap-2.5">
                <span className="h-4 w-6 rounded bg-brand-100" aria-hidden="true" />
                {changed} {changed === 1 ? "line" : "lines"} reworded to match the job{pending.lines ? `, ${pending.lines} waiting for your yes` : ""}
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
            {pending.lines ? (
              <Button size="sm" variant="secondary" className="mt-4 w-full" onClick={acceptAll} disabled={busy}>
                <TickCircle size={18} variant="bulk" />
                Accept all {pending.lines} suggested {pending.lines === 1 ? "line" : "lines"}
              </Button>
            ) : null}
            <p className="mt-4 flex gap-2 rounded-2xl bg-ink-50 p-3 text-[0.8125rem] leading-5 text-ink-600">
              <InfoCircle size={18} className="mt-px shrink-0" />
              Tap any line to see the words it came from. Suggested lines go on your CV only when you accept them.
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

          {/* The next step, spelled out (founder, round 20: the old link wasn't clear enough). */}
          {nextHref ? (
            <Link href={nextHref} className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-card transition-colors hover:border-brand-400">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
                <Sms size={22} variant="bulk" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold text-ink-900">Next: prepare your email</span>
                <span className="block text-[0.8125rem] leading-5 text-ink-600">We write the email or cover note to send with this CV. You send it yourself.</span>
              </span>
              <ArrowRight size={20} className="shrink-0 text-brand-700 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </aside>
      </div>

      <dialog ref={sheet} aria-labelledby="sheet-title" className="m-auto w-[min(92vw,560px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
        <ModalHeader id="sheet-title" title="A few things before you download" description="Anything you haven't accepted goes in your own words. An interviewer could ask about any line." onClose={() => sheet.current?.close()} />
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 pb-2 sm:px-7">
          {pending.summary ? (
            <div className="rounded-2xl bg-brand-50 p-3.5 text-[0.8125rem] leading-5">
              <p className="font-semibold text-ink-900">Your summary for this job isn&apos;t confirmed</p>
              <p className="mt-1 text-ink-700">&ldquo;{doc.summary.text}&rdquo;</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <SuggestButton onClick={() => chooseSummary("suggested")} disabled={busy} tone="yes">
                  Use this summary
                </SuggestButton>
                {doc.summary.own ? (
                  <SuggestButton onClick={() => chooseSummary("own")} disabled={busy}>
                    Keep my own
                  </SuggestButton>
                ) : null}
              </div>
            </div>
          ) : null}
          {pending.lines ? (
            <div className="rounded-2xl bg-brand-50 p-3.5 text-[0.8125rem] leading-5">
              <p className="font-semibold text-ink-900">
                {pending.lines} suggested {pending.lines === 1 ? "line isn't" : "lines aren't"} accepted yet
              </p>
              <p className="mt-1 text-ink-700">Accept them to use the wording that fits this job, or download now with your own words.</p>
              <SuggestButton onClick={acceptAll} disabled={busy} tone="yes" className="mt-2">
                Accept all
              </SuggestButton>
            </div>
          ) : null}
          {flagged.length ? (
            <ul className="space-y-2.5">
              {flagged.map((b) => (
                <li key={b.id} className="rounded-2xl bg-care-50 p-3.5 text-[0.8125rem] leading-5 text-care-700">
                  <p className="font-semibold text-ink-900">{b.text}</p>
                  <p className="mt-1">{b.flags.find((f) => f.status === "open")?.message}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid gap-2 px-5 pb-6 pt-3 sm:grid-cols-2 sm:px-7">
          <Button
            variant="secondary"
            onClick={() => {
              sheet.current?.close();
              const first = flagged[0] ?? bullets.find((b) => b.pending);
              if (first && findBullet(doc, first.id)) setOpen(first.id);
            }}
          >
            Review first
          </Button>
          <Button
            onClick={() => {
              sheet.current?.close();
              download(pendingType.current, true);
            }}
          >
            Download now
          </Button>
        </div>
      </dialog>
    </div>
  );
}

/** The suggested summary for this job: use it, keep your own, or edit it (D-163). */
function SummaryBlock({ doc, busy, onChoose }: { doc: CvDoc; busy: boolean; onChoose: (c: "suggested" | "own" | "edit", text?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.summary.text);
  const waiting = doc.summary.confirmed === false;
  const flags = doc.summary.flags.filter((f) => f.status === "open");
  if (editing)
    return (
      <div className="space-y-2 font-[family-name:var(--font-sans)]">
        <label htmlFor="sum-edit" className="sr-only">
          Edit your summary
        </label>
        <textarea id="sum-edit" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputClass} py-2.5 text-sm leading-6`} />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => (onChoose("edit", draft), setEditing(false))} disabled={busy || draft.trim().length < 20}>
            Save summary
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  return (
    <div>
      <p className={`rounded px-1 text-sm leading-6 text-ink-800 ${flags.length ? "bg-care-100/70" : waiting ? "bg-brand-50 ring-1 ring-brand-100" : ""}`}>{doc.summary.text || doc.summary.own}</p>
      {flags.map((f) => (
        <p key={f.token} className="mt-1 px-1 font-[family-name:var(--font-sans)] text-xs text-care-700">
          {f.message} (&ldquo;{f.token}&rdquo;)
        </p>
      ))}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-[family-name:var(--font-sans)]">
        {waiting ? (
          <>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-brand-700">Suggested for this job{doc.summary.own ? ", from your summary" : ""}</span>
            <SuggestButton onClick={() => onChoose("suggested")} disabled={busy} tone="yes">
              <TickCircle size={14} variant="bulk" />
              Use this
            </SuggestButton>
            {doc.summary.own ? (
              <SuggestButton onClick={() => onChoose("own")} disabled={busy}>
                Keep my own
              </SuggestButton>
            ) : null}
          </>
        ) : null}
        <SuggestButton onClick={() => (setDraft(doc.summary.text || doc.summary.own || ""), setEditing(true))} disabled={busy}>
          <Edit2 size={13} />
          Edit
        </SuggestButton>
      </div>
      {waiting && doc.summary.own ? (
        <details className="mt-1.5 px-1 font-[family-name:var(--font-sans)] text-xs text-ink-600">
          <summary className="cursor-pointer font-semibold text-ink-700">See your own summary</summary>
          <p className="mt-1 leading-5">{doc.summary.own}</p>
        </details>
      ) : null}
    </div>
  );
}

/** One "Download CV" button; the format is chosen from a short menu (founder, round 20). */
function DownloadMenu({ onPick, disabled, full = false }: { onPick: (t: FileType) => void; disabled: boolean; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const pick = (t: FileType) => {
    setOpen(false);
    onPick(t);
  };
  return (
    <div ref={box} className={`relative ${full ? "w-full" : ""}`}>
      <Button size="lg" className={`w-full whitespace-nowrap ${full ? "" : "sm:w-auto"}`} onClick={() => setOpen((o) => !o)} disabled={disabled} aria-haspopup="menu" aria-expanded={open}>
        <DocumentDownload size={20} variant="bulk" />
        Download CV
        <ArrowDown2 size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open ? (
        <div role="menu" className={`absolute z-30 mt-2 w-64 animate-pop rounded-2xl border border-ink-150 bg-white p-1.5 shadow-raised ${full ? "left-0 right-0 w-auto" : "right-0 sm:left-0 sm:right-auto"}`}>
          <MenuItem onClick={() => pick("pdf")} icon={<DocumentDownload size={20} variant="bulk" />} title="PDF" body="Best for most jobs. Looks the same everywhere." />
          <MenuItem onClick={() => pick("docx")} icon={<DocumentText size={20} variant="bulk" />} title="Word file" body="When the employer asks for .doc or .docx." />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ onClick, icon, title, body }: { onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-brand-50">
      <span className="mt-0.5 text-brand-700">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="block text-xs leading-4 text-ink-500">{body}</span>
      </span>
    </button>
  );
}

/** "Next: prepare your email", a real button beside Download CV; it turns solid once the CV is downloaded. */
function NextButton({ href, strong }: { href: string; strong: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 text-[0.9375rem] font-semibold transition-colors ${strong ? "bg-ink-900 text-white hover:bg-ink-800" : "border-[1.5px] border-brand-600 bg-white text-brand-700 hover:bg-brand-50"}`}
    >
      <span className="sm:hidden">Next: email</span>
      <span className="hidden sm:inline">Next: prepare your email</span>
      <ArrowRight size={18} />
    </Link>
  );
}

function SuggestButton({ children, onClick, disabled, tone, className = "" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "yes"; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-60 ${tone === "yes" ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-white text-ink-700 ring-1 ring-ink-150 hover:bg-ink-75"} ${className}`}
    >
      {children}
    </button>
  );
}

/** "a, b and c" with a capital first letter. */
function sentence(parts: (string | null)[]): string {
  const p = parts.filter((x): x is string => Boolean(x));
  const text = p.length > 1 ? `${p.slice(0, -1).join(", ")} and ${p.at(-1)}` : (p[0] ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
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
