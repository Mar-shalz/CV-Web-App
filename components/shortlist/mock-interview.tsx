"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { startMockInterview, answerMockInterview, endMockInterview } from "@/app/(app)/applications/[id]/shortlist/actions";
import type { MockState, MockTurn } from "@/lib/shortlist/mock";
import { ANSWER_TIPS } from "@/lib/shortlist/tips";
import { VoiceRecorder } from "@/components/vault/voice-recorder";
import { Button } from "@/components/ui/button";
import { Messages2, VolumeHigh, Lamp, DocumentText, TickCircle, Warning2, Danger, Repeat, Teacher, ArrowDown2 } from "@/components/icons";

const KIND: Record<MockTurn["kind"], string> = {
  intro: "Opening question",
  follow_up: "Follow-up on your answer",
  defend_cv: "From your CV",
  job_fit: "Fit for the job",
  situational: "What would you do",
  technical: "Technical",
  standard: "Common question",
  closing: "Closing question",
};
const TIP: Record<MockTurn["kind"], string> = {
  ...ANSWER_TIPS,
  follow_up: "Stay with the example you just gave: add the detail they asked for, and finish with what happened.",
  closing: "Ask one or two real questions about the role or the team, such as what success looks like in the first three months.",
};
const MATCH = {
  yes: { label: "Matches your CV", cls: "bg-proof-50 text-proof-700", icon: TickCircle },
  partly: { label: "Partly matches your CV", cls: "bg-care-50 text-care-700", icon: Warning2 },
  no: { label: "Doesn't match your CV", cls: "bg-flag-50 text-flag-700", icon: Danger },
} as const;

/**
 * The mock interview (founder round 26, D-189): one question at a time, like the real
 * interview. After each answer: short feedback, then the next question, often a follow
 * up on what was just said. Answer by voice or typing; the question can be read aloud.
 */
export function MockInterview({ applicationId, initial, voice }: { applicationId: string; initial: MockState | null; voice: boolean }) {
  const [mock, setMock] = useState<MockState | null>(initial);
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState<"voice" | "text">("text");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [ending, startEnd] = useTransition();
  const [canSpeak, setCanSpeak] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const current = mock && !mock.done ? mock.turns.at(-1) : null;
  const answered = mock?.turns.filter((t) => t.answer) ?? [];

  /** Reads the question aloud with the phone's own voice: no download, no data. */
  function speak(text: string) {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      u.voice = voices.find((v) => v.lang === "en-NG") ?? voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
      u.lang = u.voice?.lang ?? "en-GB";
      u.rate = 0.95;
      synth.speak(u);
    } catch {}
  }

  function begin() {
    setError(null);
    start(async () => {
      const res = await startMockInterview(applicationId);
      if (!res.ok) return setError(res.error);
      setMock(res.mock);
      setAnswer("");
      setShowTranscript(false);
    });
  }

  function send() {
    setError(null);
    start(async () => {
      const res = await answerMockInterview(applicationId, { answer, mode, state: mock });
      if (!res.ok) return setError(res.error);
      setMock(res.mock);
      setAnswer("");
      setMode("text");
      requestAnimationFrame(() => currentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  }

  function finish() {
    setError(null);
    startEnd(async () => {
      const res = await endMockInterview(applicationId, mock);
      if (!res.ok) return setError(res.error);
      setMock(res.mock.turns.length ? res.mock : null);
    });
  }

  const header = (
    <div className="flex flex-wrap items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Messages2 size={22} variant="bulk" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-ink-900">Mock Interview</h2>
        <p className="text-[0.8125rem] leading-5 text-ink-600">One question at a time, like the real thing. The next question builds on your answer.</p>
      </div>
      {mock && !mock.done ? (
        <span className="rounded-full bg-ink-75 px-3 py-1 text-xs font-semibold text-ink-700">
          Question {mock.turns.length} of {mock.total}
        </span>
      ) : null}
    </div>
  );

  // Not started yet.
  if (!mock) {
    return (
      <section aria-label="Mock interview" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        {header}
        <ul className="mt-4 grid gap-2 text-[0.8125rem] text-ink-700 sm:grid-cols-3">
          {["About 10 minutes, 7 questions", "Answer by voice or by typing", "Feedback after every answer"].map((t) => (
            <li key={t} className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5">
              <TickCircle size={16} variant="bulk" className="shrink-0 text-proof-600" />
              {t}
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-flag-700">
            {error}
          </p>
        ) : null}
        <Button size="lg" className="cta-sheen mt-4 w-full sm:w-auto" onClick={begin} disabled={busy} aria-busy={busy || undefined}>
          <Teacher size={20} variant="bulk" />
          {busy ? "Starting" : "Start the mock interview"}
        </Button>
      </section>
    );
  }

  // Finished: how it went, then practise again.
  if (mock.done) {
    return (
      <section aria-label="Mock interview" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        {header}
        <div className="mt-4 rounded-2xl bg-gradient-to-b from-proof-50 to-white p-4 ring-1 ring-proof-100" role="status">
          <h3 className="text-[0.9375rem] font-semibold text-ink-900">How You Did</h3>
          <p className="text-[0.8125rem] text-ink-600">
            {answered.length} {answered.length === 1 ? "question" : "questions"} answered.
          </p>
          {mock.wrap?.strengths.length ? (
            <ul className="mt-3 space-y-1.5">
              {mock.wrap.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-sm leading-6 text-ink-800">
                  <TickCircle size={18} variant="bulk" className="mt-0.5 shrink-0 text-proof-600" />
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
          {mock.wrap?.workOn.length ? (
            <>
              <h4 className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Practise before the day</h4>
              <ul className="mt-2 space-y-1.5">
                {mock.wrap.workOn.map((s) => (
                  <li key={s} className="flex gap-2 text-sm leading-6 text-ink-800">
                    <Lamp size={18} className="mt-0.5 shrink-0 text-care-600" />
                    {s}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        {answered.length ? (
          <div className="mt-3">
            <button type="button" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              {showTranscript ? "Hide the interview" : "See the interview and feedback"}
              <ArrowDown2 size={16} className={`transition-transform ${showTranscript ? "rotate-180" : ""}`} />
            </button>
            {showTranscript ? (
              <ol className="mt-2 space-y-4">
                {answered.map((t, i) => (
                  <Turn key={t.id} n={i + 1} t={t} />
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-flag-700">
            {error}
          </p>
        ) : null}
        <Button variant="outline" className="mt-4" onClick={begin} disabled={busy} aria-busy={busy || undefined}>
          <Repeat size={18} />
          {busy ? "Starting" : "Practise again"}
        </Button>
      </section>
    );
  }

  // In progress.
  return (
    <section aria-label="Mock interview" className="rounded-[var(--radius-card)] border border-brand-200 bg-white p-5 shadow-card lg:p-6">
      {header}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={mock.total} aria-valuenow={answered.length} aria-label="Questions answered">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${(answered.length / mock.total) * 100}%` }} />
      </div>

      {answered.length ? (
        <ol className="mt-4 space-y-4">
          {answered.map((t, i) => (
            <Turn key={t.id} n={i + 1} t={t} compact={i < answered.length - 1} />
          ))}
        </ol>
      ) : null}

      {current ? (
        <div ref={currentRef} className="mt-4 scroll-mt-24 space-y-3 border-t border-ink-100 pt-4">
          <Question n={mock.turns.length} t={current} onSpeak={canSpeak ? () => speak(current.question) : undefined} />
          <div className="flex items-start gap-3 rounded-2xl border border-proof-100 bg-proof-50 p-3.5 shadow-[inset_4px_0_0_var(--color-proof-500)]">
            <p className="text-[0.8125rem] leading-5 text-ink-800">
              <span className="block text-xs font-bold uppercase tracking-[0.08em] text-proof-700">How to answer</span>
              {TIP[current.kind]}
            </p>
          </div>
          {busy ? (
            <p aria-live="polite" className="flex items-center gap-2 rounded-2xl bg-ink-50 p-4 text-sm font-medium text-ink-700">
              <span className="size-4 animate-spin rounded-full border-2 border-brand-600 border-r-transparent" aria-hidden="true" />
              The interviewer is reading your answer…
            </p>
          ) : (
            <div>
              {voice ? (
                <VoiceRecorder
                  disabled={busy}
                  onText={(t) => {
                    setMode("voice");
                    setAnswer((cur) => (cur ? `${cur} ${t}` : t));
                  }}
                />
              ) : null}
              <label htmlFor={`mock-${current.id}`} className={`block text-sm font-semibold text-ink-900 ${voice ? "mt-4" : ""}`}>
                {voice ? "Your answer (what you said appears here: fix any words before you send it)" : "Your answer"}
              </label>
              <textarea
                id={`mock-${current.id}`}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                maxLength={3000}
                placeholder="Answer the way you'd say it in the room"
                className="mt-2 w-full resize-y rounded-2xl border border-ink-200 bg-white p-4 text-[0.9375rem] leading-6 text-ink-900 placeholder:text-ink-350 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {error ? (
                <p role="alert" className="mt-2 text-sm text-flag-700">
                  {error}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={send} disabled={busy || answer.trim().length < 15} aria-busy={busy || undefined}>
                  {mock.turns.length >= mock.total ? "Answer and finish" : "Answer"}
                </Button>
                {answered.length ? (
                  <button type="button" onClick={finish} disabled={ending} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-ink-600 hover:text-ink-900 disabled:opacity-60">
                    {ending ? "Wrapping up" : "End and see how I did"}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Question({ n, t, onSpeak }: { n: number; t: MockTurn; onSpeak?: () => void }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 text-[0.8125rem] font-semibold text-white" aria-hidden="true">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">{KIND[t.kind]}</p>
        <p className="mt-1 text-[1.0625rem] font-semibold leading-7 text-ink-900">{t.question}</p>
        {t.why ? (
          <p className="mt-1 flex items-start gap-1.5 text-[0.8125rem] leading-5 text-ink-600">
            <Lamp size={16} className="mt-0.5 shrink-0 text-care-600" />
            {t.why}
          </p>
        ) : null}
        {t.bulletText ? (
          <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-[0.8125rem] leading-5 text-ink-700 ring-1 ring-paper-edge">
            <span className="flex items-center gap-1 text-xs font-semibold text-ink-500">
              <DocumentText size={13} />
              On the CV you sent
            </span>
            {t.bulletText}
          </p>
        ) : null}
        {onSpeak ? (
          <button type="button" onClick={onSpeak} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50">
            <VolumeHigh size={16} />
            Hear the question
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Turn({ n, t, compact = false }: { n: number; t: MockTurn; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const m = t.feedback ? MATCH[t.feedback.matches] : null;
  const Icon = m?.icon;
  return (
    <li className="space-y-2">
      <Question n={n} t={{ ...t, why: compact ? null : t.why, bulletText: compact ? null : t.bulletText }} />
      <div className="ml-12 rounded-2xl rounded-tl-md bg-brand-50 px-4 py-3 text-[0.9375rem] leading-6 text-ink-800">
        <span className="sr-only">Your answer: </span>
        {t.answer}
      </div>
      {t.feedback && m && Icon ? (
        <div className="ml-12">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold ${m.cls}`}>
            <Icon size={16} variant="bulk" />
            {m.label}
            <ArrowDown2 size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open ? (
            <div className="mt-2 space-y-2 animate-rise">
              {t.feedback.didWell ? <p className="text-sm leading-6 text-ink-700">{t.feedback.didWell}</p> : null}
              {t.feedback.issues.map((i) => (
                <p key={i} className="flex items-start gap-2 rounded-xl bg-flag-50 p-3 text-[0.8125rem] leading-5 text-flag-700">
                  <Danger size={16} className="mt-0.5 shrink-0" />
                  {i}
                </p>
              ))}
              {t.feedback.improve.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">To make it stronger</p>
                  <ul className="mt-1 space-y-1">
                    {t.feedback.improve.map((p) => (
                      <li key={p} className="flex gap-2 text-sm leading-6 text-ink-800">
                        <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
