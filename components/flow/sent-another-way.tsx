"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sentFromCv } from "@/app/(app)/jobs/[id]/cv/actions";
import { SENT_VIA, SENT_VIA_LABELS, SENT_VIA_PHRASE, type SentVia } from "@/lib/applications/sent-via";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";
import { ArrowRight, Send2, Sms, TickCircle, DocumentText } from "@/components/icons";
import { formatDate } from "@/lib/format";

export type ApplyChannel = "email" | "form" | "portal" | "whatsapp" | "in_person" | "unknown";
export type SendInfo = { channel: ApplyChannel; applicationId: string | null; sentAt: string | null; sentVia: SentVia | null };

/** What comes after the CV, named for how this job takes applications (founder round 32, D-199). */
export function nextStep(channel: ApplyChannel): { title: string; short: string; body: string } {
  if (channel === "email") return { title: "Next: prepare your email", short: "Next: email", body: "We write the email to send with this CV. You send it yourself." };
  if (channel === "form") return { title: "Next: get ready for the form", short: "Next: form", body: "We draft your answers for their application form and list what to attach. You apply yourself." };
  if (channel === "portal") return { title: "Next: get ready to apply online", short: "Next: apply", body: "We list the steps on their website and draft your answers. You apply yourself." };
  return { title: "Next: prepare a cover note", short: "Next: note", body: "A short note to send with your CV, by email or WhatsApp. You send it yourself." };
}

/**
 * "Sent it another way?" Not every job wants the email we prepare: some take the CV on
 * WhatsApp, a job site like Indeed or Jobberman, the company's website, or by hand. One
 * tap logs it, with the CV on screen as the record (D-199).
 */
export function SentAnotherWay({ jobId, cvId, send, variant, unaccepted }: { jobId: string; cvId: string; send: SendInfo; variant: "link" | "card"; unaccepted: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [via, setVia] = useState<SentVia | null>(send.channel === "whatsapp" ? "whatsapp" : send.channel === "in_person" ? "in_person" : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (send.sentAt) {
    const how = send.sentVia ? ` ${SENT_VIA_PHRASE[send.sentVia]}` : "";
    const line = `You sent this application${how} on ${formatDate(send.sentAt)}.`;
    if (variant === "link")
      return (
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-proof-700">
          <TickCircle size={16} variant="bulk" className="shrink-0" />
          {line}
          {send.applicationId ? (
            <Link href={`/applications/${send.applicationId}`} className="font-semibold text-brand-700 underline-offset-2 hover:underline">
              See it
            </Link>
          ) : null}
        </p>
      );
    return (
      <section className="rounded-[var(--radius-card)] border border-proof-100 bg-proof-50 p-4 text-[0.8125rem] leading-5 text-proof-700">
        <p className="flex items-center gap-1.5 font-semibold">
          <TickCircle size={18} variant="bulk" />
          Sent
        </p>
        <p className="mt-1 text-ink-700">{line} We keep the CV you sent with it.</p>
        {send.applicationId ? (
          <Link href={`/applications/${send.applicationId}`} className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700">
            See your application <ArrowRight size={16} />
          </Link>
        ) : null}
      </section>
    );
  }

  function confirm() {
    if (!via) return setError("Pick how you sent it.");
    setError(null);
    start(async () => {
      const res = await sentFromCv(jobId, cvId, via);
      if (!res.ok) return setError(res.error);
      dialog.current?.close();
      router.push(`/applications/${res.applicationId}`);
    });
  }

  const trigger =
    variant === "link" ? (
      <p className="text-[0.8125rem] text-ink-600">
        Sent it another way, like WhatsApp or a job site?{" "}
        <button type="button" onClick={() => dialog.current?.showModal()} className="font-semibold text-brand-700 underline-offset-2 hover:underline">
          Mark as sent
        </button>
      </p>
    ) : (
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="group flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 text-left shadow-card transition-colors hover:border-brand-300"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink-75 text-ink-800">
          <Send2 size={22} variant="bulk" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink-900">Already sent it? Mark as sent</span>
          <span className="block text-[0.8125rem] leading-5 text-ink-600">On WhatsApp, Indeed, Jobberman, their website or by hand. We keep this CV as the one you sent.</span>
        </span>
        <ArrowRight size={20} className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" />
      </button>
    );

  return (
    <>
      {trigger}
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto w-[min(92vw,480px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
        <ModalHeader id={titleId} title="How did you send it?" description="We keep this CV with the application, exactly as it is now, and check in with you about it later." onClose={() => dialog.current?.close()} />
        <fieldset className="mt-1 space-y-2 px-5 pt-1 sm:px-7">
          <legend className="sr-only">How you sent it</legend>
          {SENT_VIA.map((v) => (
            <label key={v} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2 ring-1 transition-colors ${via === v ? "bg-brand-50 ring-brand-500" : "bg-white ring-ink-150 hover:bg-ink-75"}`}>
              <input type="radio" name="sent_via" value={v} checked={via === v} onChange={() => setVia(v)} className="size-4 accent-brand-600" />
              <span>
                <span className="block text-sm font-semibold text-ink-900">{SENT_VIA_LABELS[v].label}</span>
                {SENT_VIA_LABELS[v].hint ? <span className="block text-xs text-ink-500">{SENT_VIA_LABELS[v].hint}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
        {unaccepted ? (
          <p className="mx-5 mt-3 flex gap-2 rounded-2xl bg-care-50 p-3 text-[0.8125rem] leading-5 text-care-700 sm:mx-7">
            <DocumentText size={18} className="mt-px shrink-0" />
            {unaccepted} suggested {unaccepted === 1 ? "change isn't" : "changes aren't"} accepted, so {unaccepted === 1 ? "it's" : "they're"} kept in your own words, as in the file you downloaded.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mx-5 mt-3 text-sm text-flag-700 sm:mx-7">
            {error}
          </p>
        ) : null}
        <div className="grid gap-2 px-5 pb-6 pt-4 sm:grid-cols-2 sm:px-7">
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            Not yet
          </Button>
          <Button onClick={confirm} disabled={busy || !via}>
            {busy ? "Saving..." : "Mark as sent"}
          </Button>
        </div>
      </dialog>
    </>
  );
}

/** The next step card under the CV, named for how this job takes applications. */
export function NextStepCard({ href, channel }: { href: string; channel: ApplyChannel }) {
  const n = nextStep(channel);
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-card transition-colors hover:border-brand-400">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
        <Sms size={22} variant="bulk" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-ink-900">{n.title}</span>
        <span className="block text-[0.8125rem] leading-5 text-ink-600">{n.body}</span>
      </span>
      <ArrowRight size={20} className="shrink-0 text-brand-700 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
