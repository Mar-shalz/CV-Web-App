"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { PackView } from "@/lib/applications/data";
import { sentIt } from "@/app/(app)/jobs/[id]/pack/actions";
import { CopyButton, CopyField } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { Sms, Send2, Share, TickCircle, TickSquare, ArrowRight, Paperclip2, ShieldTick, Global, DocumentDownload, Danger } from "@/components/icons";

/**
 * The application pack (screen 16). Email: copy each part, share the CV straight into
 * Gmail, or open the mail app with subject and body filled. Forms and portals: the field
 * list or steps. The person always sends it themselves.
 */
export function SendPack({ pack, applicationId, cvId, alreadySent }: { pack: PackView; applicationId: string; cvId: string; alreadySent: boolean }) {
  const [checks, setChecks] = useState(pack.checklist.map(() => false));
  const [sent, setSent] = useState(alreadySent);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // Both come from the job post, so they're checked: a plain address only (no extra
  // headers like ?bcc= smuggled in), and only web links.
  const safeEmail = pack.toEmail && /^[^\s@?&#,;]+@[^\s@?&#,;]+\.[a-z]{2,}$/i.test(pack.toEmail) ? pack.toEmail : null;
  const applyUrl = pack.applyUrl && /^https?:\/\//i.test(pack.applyUrl) ? pack.applyUrl : null;
  const mailto = safeEmail ? `mailto:${safeEmail}?subject=${encodeURIComponent(pack.subject)}&body=${encodeURIComponent(pack.body)}` : null;
  const cvUrl = `/api/cv/${cvId}/export?type=pdf`;
  const cvName = pack.attachmentNames[0] ?? "CV.pdf";

  async function share() {
    setNote(null);
    try {
      const blob = await (await fetch(cvUrl)).blob();
      const file = new File([blob], cvName, { type: "application/pdf" });
      // Copy the subject and body first: not every app picks them up from the share.
      await navigator.clipboard?.writeText(`${pack.subject}\n\n${pack.body}`).catch(() => {});
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: pack.subject, text: pack.body });
        setNote("Shared. If your email app didn't fill the subject and message, paste them: they're copied.");
      } else {
        setNote("Sharing files isn't available in this browser. Download the CV, then open your email app below.");
      }
    } catch {
      setNote("Sharing didn't finish. Download the CV and attach it in your email app.");
    }
  }

  function confirmSent() {
    setError(null);
    start(async () => {
      const res = await sentIt(applicationId);
      if (res.ok) setSent(true);
      else setError(res.error ?? "That didn't save. Try again in a moment.");
    });
  }

  if (sent) {
    return (
      <section className="mx-auto max-w-xl animate-pop rounded-[var(--radius-panel)] border border-proof-100 bg-gradient-to-b from-proof-50 to-white p-8 text-center" role="status">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-proof-600 text-white shadow-raised">
          <TickCircle size={44} variant="bulk" />
        </span>
        <h2 className="mt-5 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">Application Saved</h2>
        <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
          We kept the job post and the exact CV you sent. If they invite you weeks from now, you&apos;ll prepare from exactly what they have.
        </p>
        <p className="mt-2 text-sm text-ink-500">We&apos;ll check in with you about it.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href={`/applications/${applicationId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
            See this application
            <ArrowRight size={18} />
          </Link>
          <Link href="/jobs/new" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-ink-200 bg-white px-5 font-semibold text-ink-900 hover:bg-ink-50">
            Tailor for another job
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
        {pack.channel === "email" ? (
          <>
            <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Sms size={22} variant="bulk" />
              </span>
              <div>
                <h2 className="text-[0.9375rem] font-semibold text-ink-900">Your Application Email</h2>
                <p className="text-[0.8125rem] text-ink-500">Copy each part, or open it ready in your email app.</p>
              </div>
            </div>
            <dl className="divide-y divide-ink-100">
              {pack.toEmail ? <Row label="To" value={pack.toEmail} /> : null}
              <Row label="Subject" value={pack.subject} note="Use this exactly. It follows the format the employer asked for." />
              <div className="px-5 py-4">
                <dt className="text-xs font-medium text-ink-500">Message</dt>
                <dd className="mt-2">
                  <CopyField value={pack.body} label="message" />
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <dt className="sr-only">Attachments</dt>
                {pack.attachmentNames.map((a) => (
                  <dd key={a} className="flex min-w-0 items-center gap-2 rounded-xl bg-ink-75 px-3 py-2 text-sm text-ink-800">
                    <Paperclip2 size={18} className="shrink-0" />
                    <span className="truncate">{a}</span>
                  </dd>
                ))}
              </div>
            </dl>
            <div className="grid gap-2 border-t border-ink-100 p-5 sm:grid-cols-2">
              <Button size="lg" onClick={share}>
                <Share size={20} variant="bulk" />
                Share CV to Gmail
              </Button>
              {mailto ? (
                <a href={mailto} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white px-5 font-semibold text-ink-900 hover:bg-ink-50">
                  <Send2 size={20} />
                  Open my email app
                </a>
              ) : null}
              <a href={cvUrl} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:col-span-2">
                <DocumentDownload size={18} />
                Download the CV
              </a>
              <p className="text-xs leading-5 text-ink-500 sm:col-span-2">
                Email apps can&apos;t attach a file from a link. &ldquo;Share CV to Gmail&rdquo; sends the file with the subject and message copied; &ldquo;Open my email app&rdquo; fills them in and you attach the downloaded CV.
              </p>
              {note ? (
                <p role="status" className="text-xs text-proof-700 sm:col-span-2">
                  {note}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Global size={22} variant="bulk" />
              </span>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900">{pack.channel === "form" ? "What the form asks for" : "How to apply on their website"}</h2>
            </div>
            {pack.channel === "form" && pack.formFields.length ? (
              <ul className="mt-4 divide-y divide-ink-100 rounded-2xl border border-ink-150">
                {pack.formFields.map((f) => (
                  <li key={f.label} className="px-4 py-3">
                    <p className="text-sm font-semibold text-ink-900">{f.label}</p>
                    <p className="text-[0.8125rem] text-ink-600">{f.hint}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {pack.portalSteps.length ? (
              <ol className="mt-4 space-y-3">
                {pack.portalSteps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-sm text-ink-800">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {applyUrl ? (
                <a href={applyUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
                  {pack.channel === "form" ? "Open the form" : "Open their website"}
                  <ArrowRight size={18} />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
              <a href={cvUrl} className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-ink-200 bg-white px-5 font-semibold text-ink-900 hover:bg-ink-50">
                <DocumentDownload size={20} />
                Download the CV
              </a>
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-3">
        <section aria-labelledby="checklist-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 id="checklist-title" className="text-[0.9375rem] font-semibold text-ink-900">
            Before you Press Send
          </h2>
          <ul className="mt-3 space-y-1">
            {pack.checklist.map((c, i) => (
              <li key={c.item}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm text-ink-800 hover:bg-ink-50">
                  <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))} className="size-5 accent-brand-600" />
                  <span className={checks[i] ? "text-ink-500 line-through" : ""}>
                    {c.item}
                    {!c.required ? <span className="ml-1 text-xs text-ink-500">(optional)</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">Sent It?</h2>
          <p className="mt-1 text-[0.8125rem] leading-5 text-ink-600">Tell us, and we&apos;ll save this application with the exact CV and job post.</p>
          {error ? (
            <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-flag-700">
              <Danger size={18} className="mt-px shrink-0" />
              {error}
            </p>
          ) : null}
          <Button size="lg" className="mt-4 w-full" onClick={confirmSent} disabled={busy} aria-busy={busy || undefined}>
            <TickSquare size={20} variant="bulk" />
            I&apos;ve sent it
          </Button>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-ink-500">
            <ShieldTick size={16} className="mt-px shrink-0" />
            We never send anything to an employer for you.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <dt className="text-xs font-medium text-ink-500">{label}</dt>
        <dd className="mt-1 break-words text-[0.9375rem] font-medium text-ink-900">{value}</dd>
        {note ? <p className="mt-1 text-xs text-care-700">{note}</p> : null}
      </div>
      <CopyButton value={value} label={label.toLowerCase()} />
    </div>
  );
}
