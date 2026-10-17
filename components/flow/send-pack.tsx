"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { PackView } from "@/lib/applications/data";
import {
  sentIt,
  rewriteEmail,
  saveEmailBody,
  reportGmailIssue,
} from "@/app/(app)/jobs/[id]/pack/actions";
import { useRouter } from "next/navigation";
import { CopyButton, CopyField } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import {
  MagicStar,
  Sms,
  Send2,
  TickCircle,
  TickSquare,
  ArrowRight,
  Paperclip2,
  ShieldTick,
  Global,
  DocumentDownload,
  Danger,
  Edit2,
} from "@/components/icons";
import { inputClass } from "@/components/ui/field";

/**
 * The application pack (screen 16). Email: copy each part, share the CV straight into
 * Gmail, or open the mail app with subject and body filled. Forms and portals: the field
 * list or steps. The person always sends it themselves.
 */
export function SendPack({
  pack,
  applicationId,
  cvId,
  alreadySent,
  jobId,
}: {
  pack: PackView;
  applicationId: string;
  cvId: string;
  alreadySent: boolean;
  jobId?: string;
}) {
  const router = useRouter();
  const [rewriting, startRewrite] = useTransition();
  const rewrite = () =>
    startRewrite(async () => {
      if (!jobId) return;
      const res = await rewriteEmail(jobId);
      if (res.ok) router.refresh();
      else setShareError(res.error ?? "We couldn't write it again just now.");
    });
  const [checks, setChecks] = useState(pack.checklist.map(() => false));
  const [sent, setSent] = useState(alreadySent);
  const [note, setNote] = useState<{ tone: "ok"; text: string } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // The message is the person's to edit (round 24); Gmail and other apps get their version.
  const [body, setBody] = useState(pack.body);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const saveBody = () =>
    startSave(async () => {
      if (draft === null) return;
      const res = await saveEmailBody(pack.id, draft);
      if (!res.ok) return setShareError(res.error ?? "We couldn't save that.");
      setShareError(null);
      setBody(draft.trim());
      setDraft(null);
    });
  const cvName = pack.attachmentNames[0] ?? "CV.pdf";
  // The design chosen on the CV screen (kept on this device), so the file matches it.
  const [style, setStyle] = useState("classic");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStyle(localStorage.getItem("rcpt-cv-style") || "classic");
    } catch {}
  }, []);
  const cvUrl = `/api/cv/${cvId}/export?type=pdf&style=${encodeURIComponent(style)}`;
  // Phones and tablets with touch hand the CV file straight to the Gmail app. Laptops use
  // Gmail in the browser: desktop share sheets don't reach Gmail, and sharing needs the tap
  // itself, which a download in between used up (the "couldn't open Gmail" error, round 22).
  const [canShareFiles, setCanShareFiles] = useState(false);
  const cvFile = useRef<File | null>(null);
  useEffect(() => {
    try {
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const ok =
        touch &&
        Boolean(
          navigator.canShare?.({
            files: [new File(["x"], "x.pdf", { type: "application/pdf" })],
          }),
        );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanShareFiles(ok);
      // Fetch the CV ahead, so tapping "Send via Gmail" can share it at once.
      if (ok)
        void fetch(`${cvUrl}&prefetch=1`)
          .then((r) => r.blob())
          .then(
            (b) =>
              (cvFile.current = new File([b], cvName, {
                type: "application/pdf",
              })),
          )
          .catch(() => {});
    } catch {}
  }, [cvUrl, cvName]);
  // Both come from the job post, so they're checked: a plain address only (no extra
  // headers like ?bcc= smuggled in), and only web links.
  const safeEmail =
    pack.toEmail && /^[^\s@?&#,;]+@[^\s@?&#,;]+\.[a-z]{2,}$/i.test(pack.toEmail)
      ? pack.toEmail
      : null;
  const applyUrl =
    pack.applyUrl && /^https?:\/\//i.test(pack.applyUrl) ? pack.applyUrl : null;
  const mailto = safeEmail
    ? `mailto:${safeEmail}?subject=${encodeURIComponent(pack.subject)}&body=${encodeURIComponent(body)}`
    : null;

  /** Saves the CV file to the device with an anchor, so the page stays open. */
  function saveCv() {
    const a = document.createElement("a");
    a.href = cvUrl;
    a.download = cvName;
    a.rel = "noopener";
    a.click();
  }

  /**
   * "Send via Gmail" (founder, rounds 21 and 23). Phones: the share sheet hands the CV file to
   * the Gmail app (subject and message are copied first, to paste). Laptops and tablets:
   * Gmail opens in a new tab with the address, subject and message filled in, and the CV
   * is saved at the same time to attach. Web pages can't attach a file to Gmail for you.
   */
  /** Asks the Chrome extension to open Gmail and attach the CV (D-181). */
  async function attachWithExtension(): Promise<{ ok: boolean; reason?: string; method?: string }> {
    const blob = await (await fetch(cvUrl)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const done = (r: { ok: boolean; reason?: string; method?: string }) => {
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve(r);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source === window && e.data?.type === "receipts:gmail-attach-result" && e.data.id === id) done(e.data.result ?? { ok: false, reason: "no_result" });
      };
      const timer = setTimeout(() => done({ ok: false, reason: "timeout" }), 75_000);
      window.addEventListener("message", onMessage);
      window.postMessage({ type: "receipts:gmail-attach", id, email: { to: safeEmail ?? "", subject: pack.subject, body }, file: { name: cvName, base64: btoa(bin) } }, location.origin);
    });
  }

  async function sendViaGmail() {
    setNote(null);
    setShareError(null);
    setOpening(true);
    try {
      if (canShareFiles && cvFile.current) {
        // Share first, while the tap still counts; then copy the words to paste.
        const shared = navigator.share({
          files: [cvFile.current],
          title: pack.subject,
          text: body,
        });
        void navigator.clipboard
          ?.writeText(`${pack.subject}\n\n${body}`)
          .catch(() => {});
        await shared;
        setNote({
          tone: "ok",
          text: "Shared to your email app with the CV attached. If the subject or message is empty, paste them: we copied them for you.",
        });
      } else if (document.documentElement.dataset.receiptsExtension === "1") {
        // Our Chrome extension is here: it opens Gmail and attaches the CV itself (D-181).
        const result = await attachWithExtension();
        if (result.ok) {
          setNote({ tone: "ok", text: "Gmail is open with your CV attached and everything filled in. Check it, then press Send." });
        } else if (result.reason === "signed_out") {
          setShareError("Sign in to Gmail in the tab we opened, then press Send via Gmail again.");
        } else {
          saveCv();
          setShareError("Gmail has changed its page, so we couldn't attach your CV this time. Our team has been told and is fixing it. We saved your CV to Downloads: attach it in Gmail with the paperclip, then press Send.");
          void reportGmailIssue(result.reason ?? "unknown", result.method ?? null);
        }
      } else {
        const gmail = `https://mail.google.com/mail/?view=cm&fs=1${safeEmail ? `&to=${encodeURIComponent(safeEmail)}` : ""}&su=${encodeURIComponent(pack.subject)}&body=${encodeURIComponent(body)}`;
        const tab = window.open(gmail, "_blank", "noopener");
        saveCv();
        if (!tab) {
          setShareError("Your browser blocked the Gmail tab. Allow pop ups for this site, or use “Another email app”.");
        } else {
          setNote({
            tone: "ok",
            text: "Gmail is open in a new tab with everything filled in. We saved your CV to Downloads: attach it there, then press Send. With our Chrome extension, your CV is attached for you.",
          });
        }
      }
    } catch (e) {
      // Closing the share sheet isn't an error.
      if ((e as Error)?.name !== "AbortError")
        setShareError(
          "We couldn't open Gmail from here. Use “Another email app”, or copy the parts above into Gmail and attach your CV.",
        );
    } finally {
      setTimeout(() => setOpening(false), 900);
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
      <section
        className="mx-auto max-w-xl animate-pop rounded-[var(--radius-panel)] border border-proof-100 bg-gradient-to-b from-proof-50 to-white p-8 text-center"
        role="status"
      >
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-proof-600 text-white shadow-raised">
          <TickCircle size={44} variant="bulk" />
        </span>
        <h2 className="mt-5 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">
          Application Saved
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
          We kept the job post and the exact CV you sent. If they invite you
          weeks from now, you&apos;ll prepare from exactly what they have.
        </p>
        <p className="mt-2 text-sm text-ink-500">
          We&apos;ll check in with you about it.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href={`/applications/${applicationId}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
          >
            See this application
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/jobs/new"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-ink-200 bg-white px-5 font-semibold text-ink-900 hover:bg-ink-50"
          >
            Tailor for another job
          </Link>
        </div>
      </section>
    );
  }

  // On phones it sits above the email card; on wide screens beside it (founder, round 24).
  const checklistFor = (where: string) => (
    <section
      aria-labelledby={`checklist-title-${where}`}
      className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card"
    >
      <h2
        id={`checklist-title-${where}`}
        className="text-[0.9375rem] font-semibold text-ink-900"
      >
        Before you Press Send
      </h2>
      {/* A checklist for you, not a form (founder, round 23: crossing items out confused). */}
      <p className="mt-0.5 text-[0.8125rem] leading-5 text-ink-500">
        What this employer asked for. Tick each one when it&apos;s ready;
        it&apos;s only for you.
      </p>
      <ul className="mt-3 space-y-1">
        {pack.checklist.map((c, i) => (
          <li key={c.item}>
            <label
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-ink-50 ${checks[i] ? "text-proof-700" : "text-ink-800"}`}
            >
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={(e) =>
                  setChecks((cur) =>
                    cur.map((v, j) => (j === i ? e.target.checked : v)),
                  )
                }
                className="size-5 accent-proof-600"
              />
              <span>
                {c.item}
                {!c.required ? (
                  <span className="ml-1 text-xs text-ink-500">(optional)</span>
                ) : null}
                {checks[i] ? (
                  <span className="ml-1.5 text-xs font-semibold">Ready</span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {pack.channel === "email" ? (
        <a
          href={cvUrl}
          download={cvName}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-brand-600 bg-white px-3.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          <DocumentDownload size={18} variant="bulk" />
          Download my CV
        </a>
      ) : null}
    </section>
  );

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="xl:hidden">{checklistFor("top")}</div>
      <section className="min-w-0 rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
        {pack.channel === "email" ? (
          <>
            <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
              <span className="hidden size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 sm:grid">
                <Sms size={22} variant="bulk" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[0.9375rem] font-semibold text-ink-900">
                  Your Application Email
                </h2>
                <p className="text-[0.8125rem] text-ink-500">
                  Copy each part, or open it ready in Gmail.
                </p>
              </div>
              {jobId ? (
                <button
                  type="button"
                  onClick={rewrite}
                  disabled={rewriting}
                  aria-busy={rewriting || undefined}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-ink-150 px-3 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-progress disabled:opacity-70"
                >
                  {rewriting ? (
                    <span
                      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                      aria-hidden="true"
                    />
                  ) : (
                    <MagicStar size={16} />
                  )}
                  {rewriting ? "Writing" : "Write it again"}
                </button>
              ) : null}
            </div>
            <dl className="divide-y divide-ink-100">
              {pack.toEmail ? <Row label="To" value={pack.toEmail} /> : null}
              <Row
                label="Subject"
                value={pack.subject}
                note="Use this exactly. It follows the format the employer asked for."
              />
              <div className="px-5 py-4">
                <dt className="text-xs font-medium text-ink-500">Message</dt>
                <dd className="mt-2">
                  {draft === null ? (
                    <>
                      <CopyField value={body} label="message" />
                      <button
                        type="button"
                        onClick={() => setDraft(body)}
                        className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        <Edit2 size={16} />
                        Edit the message
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="email-body" className="sr-only">
                        Your message
                      </label>
                      <textarea
                        id="email-body"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={Math.min(
                          22,
                          Math.max(10, draft.split("\n").length + 2),
                        )}
                        className={`${inputClass} py-3 text-sm leading-6`}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveBody}
                          disabled={saving || draft.trim().length < 20}
                        >
                          {saving ? "Saving" : "Save message"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDraft(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <dt className="sr-only">Attachments</dt>
                {pack.attachmentNames.map((a) => (
                  <dd
                    key={a}
                    className="flex min-w-0 items-center gap-2 rounded-xl bg-ink-75 px-3 py-2 text-sm text-ink-800"
                  >
                    <Paperclip2 size={18} className="shrink-0" />
                    <span className="truncate">{a}</span>
                  </dd>
                ))}
                {/* Send via Gmail sits where Download my CV was (founder, round 23). */}
                <dd className="ml-auto flex flex-wrap items-center gap-2">
                  {mailto ? (
                    <a
                      href={mailto}
                      className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline"
                    >
                      Another email app
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={sendViaGmail}
                    disabled={opening}
                    aria-busy={opening || undefined}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-progress disabled:opacity-80"
                  >
                    {opening ? (
                      <span
                        className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent"
                        aria-hidden="true"
                      />
                    ) : (
                      <Send2 size={18} variant="bulk" />
                    )}
                    {opening ? "Opening Gmail" : "Send via Gmail"}
                  </button>
                </dd>
              </div>
            </dl>
            {shareError || note ? (
              <div className="border-t border-ink-100 px-5 py-4">
                {shareError ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl bg-flag-50 p-3 text-sm font-medium text-flag-700 ring-1 ring-flag-100"
                  >
                    <Danger
                      size={18}
                      variant="bulk"
                      className="mt-px shrink-0"
                    />
                    {shareError}
                  </p>
                ) : note ? (
                  <p
                    role="status"
                    className="flex items-start gap-2 rounded-2xl bg-proof-50 p-3 text-sm font-medium text-proof-700 ring-1 ring-proof-100"
                  >
                    <TickCircle
                      size={18}
                      variant="bulk"
                      className="mt-px shrink-0"
                    />
                    {note.text}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Global size={22} variant="bulk" />
              </span>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900">
                {pack.channel === "form"
                  ? "What the form asks for"
                  : "How to apply on their website"}
              </h2>
            </div>
            {pack.channel === "form" && pack.formFields.length ? (
              <ul className="mt-4 divide-y divide-ink-100 rounded-2xl border border-ink-150">
                {pack.formFields.map((f) => (
                  <li key={f.label} className="px-4 py-3">
                    <p className="text-sm font-semibold text-ink-900">
                      {f.label}
                    </p>
                    <p className="text-[0.8125rem] text-ink-600">{f.hint}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {pack.portalSteps.length ? (
              <ol className="mt-4 space-y-3">
                {pack.portalSteps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-sm text-ink-800">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {applyUrl ? (
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
                >
                  {pack.channel === "form"
                    ? "Open the form"
                    : "Open their website"}
                  <ArrowRight size={18} />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
              <a
                href={cvUrl}
                className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-ink-200 bg-white px-5 font-semibold text-ink-900 hover:bg-ink-50"
              >
                <DocumentDownload size={20} />
                Download the CV
              </a>
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-3">
        <div className="hidden xl:block">{checklistFor("side")}</div>

        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">
            Sent It?
          </h2>
          <p className="mt-1 text-[0.8125rem] leading-5 text-ink-600">
            Tell us, and we&apos;ll save this application with the exact CV and
            job post.
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 text-sm text-flag-700"
            >
              <Danger size={18} className="mt-px shrink-0" />
              {error}
            </p>
          ) : null}
          <Button
            variant="outline"
            size="lg"
            className="mt-4 w-full"
            onClick={confirmSent}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            <TickSquare size={20} variant="bulk" />
            I&apos;ve sent it
          </Button>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-ink-500">
            <ShieldTick size={16} className="mt-px shrink-0" />
            We never send anything to an employer for you.
          </p>
        </section>

        {pack.channel === "email" ? (
          <section
            aria-labelledby="how-title"
            className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card"
          >
            <h2
              id="how-title"
              className="text-[0.9375rem] font-semibold text-ink-900"
            >
              How to Send It Yourself
            </h2>
            <p className="mt-0.5 text-[0.8125rem] leading-5 text-ink-500">
              If &ldquo;Send via Gmail&rdquo; doesn&apos;t open, or you use
              another email, it takes about a minute:
            </p>
            <ol className="mt-3 space-y-3">
              <Step
                n={1}
                title="Download your CV"
                body="Use “Download my CV” above. It saves to your Downloads folder (Files on a phone)."
              />
              <Step
                n={2}
                title="Start a new email"
                body="Open Gmail or your email app and press Compose."
              />
              <Step
                n={3}
                title="Copy the three parts"
                body="Copy the To address, the Subject and the Message from your application email, using each Copy button."
              />
              <Step
                n={4}
                title="Attach your CV"
                body="Press the paperclip and pick the CV you downloaded."
              />
              <Step
                n={5}
                title="Press Send, then come back"
                body="Tap “I've sent it” so we keep this application with the exact CV you sent."
              />
            </ol>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <dt className="text-xs font-medium text-ink-500">{label}</dt>
        <dd className="mt-1 break-words text-[0.9375rem] font-medium text-ink-900">
          {value}
        </dd>
        {note ? <p className="mt-1 text-xs text-care-700">{note}</p> : null}
      </div>
      <CopyButton value={value} label={label.toLowerCase()} />
    </div>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-[0.8125rem] leading-5 text-ink-600">{body}</p>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </li>
  );
}
