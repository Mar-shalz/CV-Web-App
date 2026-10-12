"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStatus } from "@/lib/rules/status-flow";
import type { OutcomeSuggestion } from "@/lib/applications/outcome";
import { setStatus, readMessage, confirmFromMessage } from "@/app/(app)/applications/[id]/actions";
import { Button } from "@/components/ui/button";
import { MagicStar, MessageText1, TickCircle, Danger, Calendar, Location, Clock, ArrowRight2, InfoCircle } from "@/components/icons";

export const ACTION_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  packed: "Ready to send",
  sent: "Sent",
  no_response: "They haven't replied",
  rejected: "Not selected",
  assessment: "Invited to a test",
  interview: "Invited to interview",
  second_interview: "Invited to a 2nd interview",
  offer: "Got an offer",
  accepted: "I accepted the offer",
  withdrawn: "I withdrew",
};

const FORMAT_LABEL = { in_person: "In person", video: "Video call", phone: "Phone call", test: "Test", unknown: "Format not stated" } as const;

function prettyDate(d: string) {
  return new Date(`${d}T12:00:00+01:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
}

/** Where it stands (screen 18): paste their reply and we read it, or tap the update yourself. */
export function StatusUpdate({ applicationId, next }: { applicationId: string; next: readonly ApplicationStatus[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"paste" | "tap">("paste");
  const [message, setMessage] = useState("");
  const [suggestion, setSuggestion] = useState<OutcomeSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!next.length) return null;

  function after(res: { ok: true; shortlist?: boolean } | { ok: false; error: string }, label: string) {
    if (!res.ok) return setError(res.error);
    if (res.shortlist) return router.push(`/applications/${applicationId}/shortlist`);
    setDone(label);
    setSuggestion(null);
    setMessage("");
    router.refresh();
  }

  function tap(to: ApplicationStatus) {
    setError(null);
    start(async () => after(await setStatus(applicationId, to), ACTION_LABELS[to]));
  }

  function read() {
    setError(null);
    setSuggestion(null);
    start(async () => {
      const res = await readMessage(applicationId, message);
      if (!res.ok) setError(res.error);
      else setSuggestion(res.suggestion);
    });
  }

  function confirm() {
    if (suggestion?.kind !== "suggest") return;
    setError(null);
    start(async () => after(await confirmFromMessage(applicationId, { to: suggestion.to, evidence: suggestion.evidence, source: suggestion.source, invite: suggestion.invite }), ACTION_LABELS[suggestion.to]));
  }

  return (
    <section aria-labelledby="update-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
      <h2 id="update-title" className="text-[0.9375rem] font-semibold text-ink-900">
        Heard back?
      </h2>
      <p className="mt-1 text-[0.8125rem] leading-5 text-ink-600">Paste their email or SMS and we&apos;ll read it, or choose the update yourself.</p>

      <div role="tablist" aria-label="How to update" className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-ink-75 p-1">
        {(["paste", "tap"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-xl text-sm font-semibold transition-all ${mode === m ? "bg-white text-ink-900 shadow-card" : "text-ink-600 hover:text-ink-900"}`}
          >
            {m === "paste" ? "Paste their reply" : "Choose an update"}
          </button>
        ))}
      </div>

      {done ? (
        <p role="status" className="mt-4 flex animate-pop items-center gap-2 rounded-2xl bg-proof-50 px-4 py-3 text-sm font-medium text-proof-700">
          <TickCircle size={18} variant="bulk" />
          Saved: {done}.
        </p>
      ) : null}

      {mode === "tap" ? (
        <ul className="mt-4 grid gap-2" role="tabpanel">
          {next.map((s) => (
            <li key={s}>
              <button
                type="button"
                disabled={busy}
                onClick={() => tap(s)}
                className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-ink-150 bg-white px-4 text-left text-sm font-semibold text-ink-800 transition-colors hover:border-brand-200 hover:bg-brand-50 disabled:opacity-60"
              >
                {ACTION_LABELS[s]}
                <ArrowRight2 size={16} className="text-ink-400 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4" role="tabpanel">
          <label htmlFor="reply" className="sr-only">
            Their message
          </label>
          <textarea
            id="reply"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={6000}
            placeholder="Paste the email or SMS from the employer here"
            className="w-full resize-y rounded-2xl border border-ink-200 bg-white p-4 text-[0.9375rem] leading-6 text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
          <Button className="mt-2 w-full" onClick={read} disabled={busy || message.trim().length < 10} aria-busy={busy || undefined}>
            <MagicStar size={20} variant="bulk" />
            {busy ? "Reading it…" : "Read it for me"}
          </Button>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-ink-500">
            <InfoCircle size={14} className="mt-0.5 shrink-0" />
            Nothing changes until you confirm. We keep the line that shows the update, not the whole message.
          </p>
        </div>
      )}

      {suggestion ? <SuggestionCard s={suggestion} busy={busy} onConfirm={confirm} onChoose={() => { setSuggestion(null); setMode("tap"); }} /> : null}

      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-flag-700">
          <Danger size={18} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SuggestionCard({ s, busy, onConfirm, onChoose }: { s: OutcomeSuggestion; busy: boolean; onConfirm: () => void; onChoose: () => void }) {
  if (s.kind === "manual" || s.kind === "unclear") {
    return (
      <div className="mt-4 animate-rise rounded-2xl border border-ink-150 bg-ink-50 p-4" role="status">
        <p className="text-sm font-semibold text-ink-900">{s.kind === "manual" ? "We couldn't read it just now." : "We can't tell what this message means for your application."}</p>
        <button type="button" onClick={onChoose} className="mt-2 min-h-11 text-sm font-semibold text-brand-700 hover:underline">
          Choose the update yourself
        </button>
      </div>
    );
  }
  const payment = s.asksForPayment ? (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-flag-50 p-3 text-[0.8125rem] leading-5 text-flag-700">
      <Danger size={18} variant="bulk" className="mt-px shrink-0" />
      This message asks you to pay. Real employers don&apos;t charge you to attend an interview or a test. Don&apos;t pay until you&apos;ve checked it with the employer on their official number or website.
    </p>
  ) : null;

  if (s.kind === "no_change") {
    return (
      <div className="mt-4 animate-rise rounded-2xl border border-ink-150 bg-ink-50 p-4" role="status">
        <p className="text-sm font-semibold text-ink-900">This looks like an automatic reply. Nothing to update yet.</p>
        {s.evidence ? <blockquote className="mt-2 border-l-2 border-ink-300 pl-3 text-[0.8125rem] italic text-ink-600">&ldquo;{s.evidence}&rdquo;</blockquote> : null}
        {payment}
      </div>
    );
  }

  return (
    <div className="mt-4 animate-rise overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50 to-white" role="status">
      <div className="p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
          <MessageText1 size={16} variant="bulk" />
          What their message says
        </p>
        <p className="mt-2 font-display text-lg font-semibold text-ink-900">{ACTION_LABELS[s.to]}</p>
        {s.evidence ? (
          <blockquote className="mt-2 border-l-2 border-brand-300 pl-3 text-[0.8125rem] leading-5 text-ink-700">&ldquo;{s.evidence}&rdquo;</blockquote>
        ) : (
          <p className="mt-2 text-[0.8125rem] text-ink-600">We couldn&apos;t point to one exact line, so check this is right.</p>
        )}
        {s.invite && (s.invite.date || s.invite.time || s.invite.placeOrLink) ? (
          <ul className="mt-3 space-y-1.5 text-sm text-ink-800">
            {s.invite.date ? (
              <li className="flex items-center gap-2">
                <Calendar size={16} className="text-brand-600" />
                {prettyDate(s.invite.date)}
              </li>
            ) : null}
            {s.invite.time ? (
              <li className="flex items-center gap-2">
                <Clock size={16} className="text-brand-600" />
                {s.invite.time} · {FORMAT_LABEL[s.invite.format]}
              </li>
            ) : null}
            {s.invite.placeOrLink ? (
              <li className="flex items-start gap-2">
                <Location size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <span className="break-words">{s.invite.placeOrLink}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
        {s.otherApplication ? <p className="mt-3 text-[0.8125rem] font-medium text-care-700">This message seems to be about a different job. Check before you confirm.</p> : null}
        {payment}
      </div>
      <div className="grid gap-2 border-t border-brand-100 p-3">
        <Button onClick={onConfirm} disabled={busy}>
          <TickCircle size={20} variant="bulk" />
          Yes, update it
        </Button>
        <Button variant="secondary" onClick={onChoose} disabled={busy}>
          No, I&apos;ll choose
        </Button>
      </div>
    </div>
  );
}
