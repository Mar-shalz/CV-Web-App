"use client";

import { useState } from "react";
import Link from "next/link";
import type { DEMO_PACK } from "@/lib/demo/job";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { Sms, Send2, DocumentText, TickCircle, TickSquare, ArrowRight, Paperclip2, ShieldTick } from "@/components/icons";

type Pack = typeof DEMO_PACK;

export function SendPack({ pack }: { pack: Pack }) {
  const [checks, setChecks] = useState(pack.checklist.map((c) => c.done));
  const [sent, setSent] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  async function share() {
    // Android share sheet straight into Gmail. The real build attaches the PDF (Web Share with files).
    try {
      if (navigator.share) {
        await navigator.share({ title: pack.subject, text: pack.body });
        return;
      }
      await navigator.clipboard.writeText(`${pack.subject}\n\n${pack.body}`);
      setShareMsg("Sharing isn't available here, so we copied the subject and message instead.");
    } catch {}
  }
  const mailto = `mailto:${pack.to}?subject=${encodeURIComponent(pack.subject)}&body=${encodeURIComponent(pack.body)}`;

  if (sent) {
    return (
      <section className="mx-auto max-w-xl animate-pop rounded-[var(--radius-panel)] border border-proof-100 bg-gradient-to-b from-proof-50 to-white p-8 text-center" role="status">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-proof-600 text-white shadow-raised">
          <TickCircle size={44} variant="bulk" />
        </span>
        <h2 className="mt-5 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">Application saved</h2>
        <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
          We kept the job post and the exact CV you sent. If they invite you weeks from now, you&apos;ll prepare from exactly what they have.
        </p>
        <p className="mt-2 text-sm text-ink-500">We&apos;ll check in with you in about a week.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/applications" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
            See my applications
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="email-title" className="min-w-0 rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Sms size={22} variant="bulk" />
          </span>
          <div>
            <h2 id="email-title" className="text-[0.9375rem] font-semibold text-ink-900">
              Your application email
            </h2>
            <p className="text-[0.8125rem] text-ink-500">Copy each part, or open it ready in your email app.</p>
          </div>
        </div>
        <dl className="divide-y divide-ink-100">
          <Row label="To" value={pack.to} />
          <Row label="Subject" value={pack.subject} note="Use this exactly. The employer asked for this format." />
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-medium text-ink-500">Message</dt>
              <CopyButton value={pack.body} label="message" />
            </div>
            <dd className="mt-2 whitespace-pre-line rounded-2xl bg-ink-50 p-4 text-sm leading-6 text-ink-800">{pack.body}</dd>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <dt className="sr-only">Attachment</dt>
            <dd className="flex min-w-0 items-center gap-2.5 rounded-xl bg-ink-75 px-3 py-2.5 text-sm text-ink-800">
              <Paperclip2 size={18} className="shrink-0" />
              <span className="truncate">{pack.attachment}</span>
            </dd>
          </div>
        </dl>
        <div className="grid gap-2 border-t border-ink-100 p-5 sm:grid-cols-2">
          <a href={mailto} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white shadow-[var(--shadow-cta)] hover:bg-brand-700">
            <Send2 size={20} variant="bulk" />
            Open my email app
          </a>
          <Button variant="secondary" size="lg" onClick={share}>
            <DocumentText size={20} />
            Share CV to Gmail
          </Button>
          {shareMsg ? (
            <p role="status" className="text-xs text-proof-700 sm:col-span-2">
              {shareMsg}
            </p>
          ) : null}
          <p className="text-xs leading-5 text-ink-500 sm:col-span-2">Email apps can&apos;t attach files from a link. After it opens, attach the CV you downloaded.</p>
        </div>
      </section>

      <aside className="space-y-5">
        <section aria-labelledby="checklist-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 id="checklist-title" className="text-[0.9375rem] font-semibold text-ink-900">
            Before you press send
          </h2>
          <ul className="mt-3 space-y-2">
            {pack.checklist.map((c, i) => (
              <li key={c.item}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm text-ink-800 hover:bg-ink-50">
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={(e) => setChecks((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="size-5 accent-brand-600"
                  />
                  <span className={checks[i] ? "text-ink-500 line-through" : ""}>{c.item}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">Sent it?</h2>
          <p className="mt-1 text-[0.8125rem] leading-5 text-ink-600">Tell us, and we&apos;ll save this application with the exact CV and job post.</p>
          <Button size="lg" className="mt-4 w-full" onClick={() => setSent(true)}>
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
