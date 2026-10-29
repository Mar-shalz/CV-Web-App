"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sentFromCv } from "@/app/(app)/jobs/[id]/cv/actions";
import { SENT_VIA_PHRASE, type SentVia } from "@/lib/applications/sent-via";
import { SentHowDialog } from "./sent-how";
import { ArrowRight, Briefcase, DocumentDownload, Global, InfoCircle, Messages2, Share, Sms, TickCircle, Edit } from "@/components/icons";
import type { ComponentType } from "react";
import type { IconProps } from "@/components/icons/make";

export type ApplyChannel = "email" | "form" | "portal" | "whatsapp" | "in_person" | "unknown";
export type SendInfo = { channel: ApplyChannel; applicationId: string | null; sentAt: string | null; sentVia: SentVia | null };
type Method = "email" | "whatsapp" | "job_site" | "website" | "in_person";

const METHODS: { id: Method; label: string; icon: ComponentType<IconProps> }[] = [
  { id: "email", label: "Email", icon: Sms },
  { id: "whatsapp", label: "WhatsApp", icon: Messages2 },
  { id: "job_site", label: "Job site", icon: Briefcase },
  { id: "website", label: "Their website", icon: Global },
  { id: "in_person", label: "By hand", icon: Edit },
];

/** The way the post asks for applications, as the first choice (round 33). */
const FROM_CHANNEL: Record<ApplyChannel, Method> = { email: "email", whatsapp: "whatsapp", form: "website", portal: "website", in_person: "in_person", unknown: "email" };

/**
 * "How are you applying?" (founder round 33, D-201). One question, asked where the person
 * already is, with the next thing to do for each answer and "I've sent it" always in reach,
 * the same words as on Ready to Send. Email and website forms lead to Ready to Send, where
 * we write the email or the form answers; WhatsApp hands the CV to the phone's share sheet;
 * a job site or by hand needs only the file. Any route ends with "I've sent it", which keeps
 * this CV as the record. Replaces the round 32 link and card, which people missed.
 */
export function SendPanel({
  jobId,
  cvId,
  send,
  nextHref,
  unaccepted,
  fileUrl,
  fileName,
  onDownload,
}: {
  jobId: string;
  cvId: string;
  send: SendInfo;
  nextHref: string;
  unaccepted: number;
  fileUrl: string;
  fileName: string;
  onDownload: () => void;
}) {
  const router = useRouter();
  const headingId = useId();
  const [method, setMethod] = useState<Method>(FROM_CHANNEL[send.channel]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    try {
      const touch = window.matchMedia("(pointer: coarse)").matches;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanShare(touch && Boolean(navigator.canShare?.({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] })));
    } catch {}
  }, []);

  if (send.sentAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-proof-50 px-4 py-3 text-sm text-proof-700" role="status">
        <span className="flex items-center gap-2 font-semibold">
          <TickCircle size={20} variant="bulk" />
          Sent{send.sentVia ? ` ${SENT_VIA_PHRASE[send.sentVia]}` : ""} on {new Date(send.sentAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        {send.applicationId ? (
          <Link href={`/applications/${send.applicationId}`} className="inline-flex min-h-10 items-center gap-1 font-semibold text-brand-700 hover:underline">
            See your application <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    );
  }

  async function shareFile() {
    setShareNote(null);
    try {
      const blob = await (await fetch(fileUrl)).blob();
      const file = new File([blob], `${fileName}.pdf`, { type: "application/pdf" });
      await navigator.share({ files: [file], title: fileName });
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") setShareNote("Your phone couldn't open the share sheet. Download the CV and attach it in WhatsApp.");
    }
  }

  function confirm(via: SentVia) {
    setError(null);
    start(async () => {
      const res = await sentFromCv(jobId, cvId, via);
      if (!res.ok) return setError(res.error);
      setAsking(false);
      router.push(`/applications/${res.applicationId}`);
    });
  }

  const step = (() => {
    switch (method) {
      case "email":
        return { hint: "We write the email to send with this CV, in the employer's format. You send it from your own email.", main: { label: "Prepare my email", href: nextHref } };
      case "website":
        return { hint: "We draft your answers for their form and list what to attach. You apply on their website yourself.", main: { label: "Get my answers ready", href: nextHref } };
      case "whatsapp":
        return { hint: canShare ? "Share the CV straight to the chat, then come back and tell us." : "Download the CV and attach it in WhatsApp, then come back and tell us.", main: null };
      case "job_site":
        return { hint: "Download the CV and upload it on Indeed, Jobberman, LinkedIn or the site you're using, then come back and tell us.", main: null };
      case "in_person":
        return { hint: "Download the PDF to print it, then tell us when you've handed it in.", main: null };
    }
  })();

  const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ink-900 px-4 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-ink-800";
  const secondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-brand-600 bg-white px-4 text-[0.9375rem] font-semibold text-brand-700 transition-colors hover:bg-brand-50";

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-[0.9375rem] font-semibold text-ink-900">
        How are you applying?
      </h2>
      <div role="radiogroup" aria-label="How you're applying" className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {METHODS.map((m) => {
          const on = m.id === method;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMethod(m.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${on ? "bg-brand-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-150 hover:bg-ink-75"}`}
            >
              <Icon size={16} variant={on ? "bulk" : "linear"} />
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[0.8125rem] leading-5 text-ink-600">{step.hint}</p>
      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        {step.main ? (
          <Link href={step.main.href} className={primary}>
            {step.main.label}
            <ArrowRight size={18} />
          </Link>
        ) : method === "whatsapp" && canShare ? (
          <button type="button" onClick={shareFile} className={primary}>
            <Share size={18} />
            Share CV to WhatsApp
          </button>
        ) : (
          <button type="button" onClick={onDownload} className={primary}>
            <DocumentDownload size={18} />
            Download CV
          </button>
        )}
        <button type="button" onClick={() => (setError(null), setAsking(true))} className={secondary}>
          <TickCircle size={18} />
          I&apos;ve sent it
        </button>
      </div>
      {shareNote ? (
        <p className="mt-2 flex gap-1.5 text-xs leading-5 text-care-700">
          <InfoCircle size={14} className="mt-0.5 shrink-0" />
          {shareNote}
        </p>
      ) : null}
      <SentHowDialog
        open={asking}
        initial={method}
        busy={busy}
        error={error}
        note={unaccepted ? `${unaccepted} suggested ${unaccepted === 1 ? "change isn't" : "changes aren't"} accepted, so ${unaccepted === 1 ? "it's" : "they're"} kept in your own words, as in the file you download.` : null}
        onClose={() => setAsking(false)}
        onConfirm={confirm}
      />
    </section>
  );
}
