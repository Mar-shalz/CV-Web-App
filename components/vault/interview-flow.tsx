"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { startInterview, submitAnswer, keepItems, type InterviewStep } from "@/app/(app)/experience/interview/actions";
import type { DraftItem, Ownership } from "@/lib/vault/schema";
import { VoiceRecorder } from "./voice-recorder";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/auth/form-error";
import { MessageQuestion, TickCircle, ArrowRight, Keyboard, Microphone2, Lamp } from "@/components/icons";

type RoleOption = { id: string; title: string | null; organisation: string | null; kind: string; items: number };
type Turn = { question: string; answer: string };

/** Marks numbers and names in a transcript so people check them (speech gets these wrong most). */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <p className="text-[0.9375rem] leading-7 text-ink-800">
      {parts.map((p, i) => {
        const prev = parts.slice(0, i).join("").trim();
        const sentenceStart = !prev || /[.!?]$/.test(prev);
        const isNumber = /\d/.test(p);
        const isName = /^[A-Z][a-z]/.test(p) && !sentenceStart && p !== "I";
        return isNumber || isName ? (
          <mark key={i} className="rounded bg-care-100 px-0.5 text-ink-900">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </p>
  );
}

export function InterviewFlow({ roles, voice, initialRoleId }: { roles: RoleOption[]; voice: boolean; initialRoleId?: string }) {
  const [roleId, setRoleId] = useState<string | null>(null);
  const [step, setStep] = useState<InterviewStep | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState<"text" | "voice">(voice ? "voice" : "text");
  const [fromVoice, setFromVoice] = useState(false);
  const [lastMode, setLastMode] = useState<"text" | "voice">("text");
  const [drafts, setDrafts] = useState<(DraftItem & { keep: boolean })[] | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const role = roles.find((r) => r.id === roleId);

  function begin(id: string) {
    setError(null);
    start(async () => {
      const res = await startInterview(id);
      if (!res.ok) return setError(res.error);
      setRoleId(id);
      setStep(res.step);
    });
  }

  function send() {
    if (!step || !roleId || answer.trim().length < 2) return;
    setError(null);
    start(async () => {
      const res = await submitAnswer({ sessionId: step.sessionId, roleId, answer, mode: fromVoice ? "voice" : "text" });
      if (!res.ok) return setError(res.error);
      setHistory((h) => [...h, { question: step.question, answer }]);
      setLastMode(fromVoice ? "voice" : "text");
      setDrafts(res.drafts.map((d) => ({ ...d, keep: true })));
      setFollowUp(res.followUp);
      setStep(res.next);
      setAnswer("");
      setFromVoice(false);
    });
  }

  function keep() {
    if (!drafts || !roleId) return;
    const chosen = drafts.filter((d) => d.keep).map((d) => ({ text: d.text, source_quote: d.source_quote, metrics: d.metrics, ownership: d.ownership, skills: d.skills }));
    start(async () => {
      if (chosen.length) {
        const res = await keepItems({ roleId, mode: lastMode, items: chosen });
        if (!res.ok) return setError(res.error ?? "We couldn't save those.");
        setSaved((s) => s + res.saved);
      }
      setDrafts(null);
    });
  }

  // 1. Choose a role
  if (!step) {
    return (
      <div className="space-y-4">
        <FormError message={error ?? undefined} />
        <p className="text-sm font-semibold text-ink-900">Which role should we talk about?</p>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => begin(r.id)}
                disabled={busy}
                className={`lift flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-card disabled:opacity-60 ${r.id === initialRoleId ? "border-brand-500" : "border-ink-150"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink-900">{r.title ?? "Untitled role"}</span>
                  <span className="block truncate text-[0.8125rem] text-ink-500">
                    {r.organisation ?? "Organisation not added"} · {r.items} {r.items === 1 ? "achievement" : "achievements"}
                  </span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-ink-400" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[0.8125rem] text-ink-500">
          Role not listed?{" "}
          <Link href="/experience/new" className="font-semibold text-brand-700 hover:underline">
            Add it first
          </Link>
          .
        </p>
      </div>
    );
  }

  // 2. Drafts from the last answer
  if (drafts) {
    return (
      <div className="animate-rise space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">{drafts.length ? "Here's what we heard. Keep the ones that are right." : "We didn't find an achievement in that one."}</h2>
        {drafts.length ? (
          <ul className="space-y-2.5">
            {drafts.map((d, i) => (
              <li key={i} className={`rounded-2xl border p-4 transition-colors ${d.keep ? "border-proof-100 bg-proof-50/50" : "border-ink-150 bg-white"}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={d.keep}
                    onChange={(e) => setDrafts((all) => all!.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                    className="mt-1 size-5 accent-proof-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] leading-6 text-ink-900">{d.text}</span>
                    <span className="mt-1 block text-xs italic text-ink-500">From your words: &ldquo;{d.source_quote}&rdquo;</span>
                  </span>
                </label>
                <div className="ml-8 mt-2.5 flex gap-1" role="radiogroup" aria-label="Your part in it">
                  {(["did", "helped", "led"] as Ownership[]).map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={d.ownership === o}
                      onClick={() => setDrafts((all) => all!.map((x, j) => (j === i ? { ...x, ownership: o } : x)))}
                      className={`min-h-10 rounded-xl px-3 text-xs font-semibold ${d.ownership === o ? "bg-ink-900 text-white" : "bg-ink-75 text-ink-600 hover:bg-ink-100"}`}
                    >
                      {o === "did" ? "I did it" : o === "helped" ? "I helped" : "I led it"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-600">That&apos;s fine. Try the next question, and mention what you did and roughly how many or how often.</p>
        )}
        {followUp ? (
          <p className="flex items-start gap-2 rounded-2xl bg-brand-50 p-3.5 text-sm text-brand-800">
            <Lamp size={20} variant="bulk" className="mt-px shrink-0" />
            {followUp} You can add it on the next answer.
          </p>
        ) : null}
        <Button size="lg" className="w-full sm:w-auto" onClick={keep} disabled={busy} aria-busy={busy || undefined}>
          {drafts.some((d) => d.keep) ? `Keep ${drafts.filter((d) => d.keep).length} and continue` : "Continue"}
          <ArrowRight size={20} />
        </Button>
      </div>
    );
  }

  // 3. The question
  const total = 8;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          {role?.title}
          {role?.organisation ? ` · ${role.organisation}` : ""}
        </p>
        <ol className="flex gap-1" aria-label={`Question ${step.turnCount + 1} of about ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <li key={i} className={`h-1.5 w-5 rounded-full ${i < step.turnCount ? "bg-proof-600" : i === step.turnCount ? "bg-brand-600" : "bg-ink-150"}`} />
          ))}
        </ol>
      </div>

      {history.length ? (
        <details className="rounded-2xl bg-ink-50 px-4 py-2 text-sm text-ink-600">
          <summary className="flex min-h-10 cursor-pointer items-center font-medium">Earlier answers ({history.length})</summary>
          <ul className="space-y-3 pb-2">
            {history.map((t, i) => (
              <li key={i}>
                <p className="font-medium text-ink-800">{t.question}</p>
                <p className="mt-0.5">{t.answer}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div key={step.question} className="flex animate-rise items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-[var(--shadow-cta)]">
          <MessageQuestion size={22} variant="bulk" />
        </span>
        <p className="rounded-2xl rounded-tl-md bg-white p-4 text-[1.0625rem] font-medium leading-7 text-ink-900 shadow-card">{step.question}</p>
      </div>

      <FormError message={error ?? undefined} />

      {voice ? (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink-75 p-1" role="radiogroup" aria-label="How to answer">
          {(["voice", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-medium ${mode === m ? "bg-white font-semibold text-ink-900 shadow-card" : "text-ink-600"}`}
            >
              {m === "voice" ? <Microphone2 size={18} /> : <Keyboard size={18} />}
              {m === "voice" ? "Speak" : "Type"}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "voice" && voice && !answer ? (
        <VoiceRecorder
          disabled={busy}
          onText={(t) => {
            setAnswer(t);
            setFromVoice(true);
          }}
        />
      ) : (
        <div className="space-y-2">
          {fromVoice ? (
            <div className="rounded-2xl border border-care-100 bg-care-50/50 p-3.5">
              <p className="mb-1.5 text-xs font-semibold text-care-700">Check the highlighted names and numbers</p>
              <Highlighted text={answer} />
            </div>
          ) : null}
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="answer"
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer in your own words. Mention what you did and roughly how many or how often."
            className={`${inputClass} resize-y py-3 leading-6`}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button size="lg" onClick={send} disabled={busy || answer.trim().length < 2} aria-busy={busy || undefined} className="sm:w-auto">
          {busy ? "Finding your achievements" : "Send answer"}
          <ArrowRight size={20} />
        </Button>
        <Link href="/experience" className="inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-ink-600 hover:bg-ink-75">
          {saved ? `Done for now (${saved} saved)` : "Stop for now"}
        </Link>
      </div>
      {!voice ? <p className="text-xs text-ink-500">Voice answers are coming soon. For now, type your answer.</p> : null}
      {step.done ? (
        <p className="flex items-center gap-2 rounded-2xl bg-proof-50 p-3.5 text-sm text-proof-700">
          <TickCircle size={20} variant="bulk" />
          That&apos;s a strong set for this role. Answer this last one, or stop here.
        </p>
      ) : null}
    </div>
  );
}
