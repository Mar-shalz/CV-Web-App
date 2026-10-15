"use client";

import { useState, useTransition } from "react";
import { makeQuestions, submitDrill } from "@/app/(app)/applications/[id]/shortlist/actions";
import type { ShortlistQuestion } from "@/lib/shortlist/questions";
import { ANSWER_TIPS } from "@/lib/shortlist/tips";
import type { DrillAttempt } from "@/lib/shortlist/data";
import { VoiceRecorder } from "@/components/vault/voice-recorder";
import { Button } from "@/components/ui/button";
import { MagicStar, DocumentText, ArrowDown2, TickCircle, Warning2, Danger, Lamp, Repeat, MessageQuestion } from "@/components/icons";

const KIND: Record<ShortlistQuestion["kind"], string> = { intro: "Always asked first", defend_cv: "Defend your CV", job_fit: "Fit for the job", situational: "What would you do", technical: "Technical", standard: "Common in this field" };
const MATCH = {
  yes: { label: "Matches your CV", cls: "bg-proof-50 text-proof-700", icon: TickCircle },
  partly: { label: "Partly matches your CV", cls: "bg-care-50 text-care-700", icon: Warning2 },
  no: { label: "Doesn't match your CV", cls: "bg-flag-50 text-flag-700", icon: Danger },
} as const;

/** Likely questions and the defend your CV drill (screens 21 and 22). */
export function Drill({ applicationId, initial, attempts, voice }: { applicationId: string; initial: ShortlistQuestion[]; attempts: DrillAttempt[]; voice: boolean }) {
  const [questions, setQuestions] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);

  function generate() {
    setError(null);
    start(async () => {
      const res = await makeQuestions(applicationId);
      if (res.ok) {
        setQuestions(res.questions);
        setOpen(res.questions[0]?.id ?? null);
      } else setError(res.error);
    });
  }

  if (!questions.length) {
    return (
      <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-6 text-center shadow-card">
        {busy ? (
          <div aria-live="polite" className="space-y-3 text-left">
            <p className="text-center text-sm font-semibold text-brand-700">Reading the job post and the CV you sent…</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-brand-50 text-brand-700">
              <MessageQuestion size={28} variant="bulk" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold text-ink-900">What Will They Ask you?</h2>
            <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-6 text-ink-600">
              Panels pick lines from your CV and ask you to defend them. We&apos;ll find the likely questions from this job and the exact CV you sent, then you practise.
            </p>
            <Button size="lg" className="cta-sheen mt-5" onClick={generate}>
              <MagicStar size={20} variant="bulk" />
              Get my likely questions
            </Button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-flag-700">
                {error}
              </p>
            ) : null}
          </>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="questions-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="questions-title" className="text-lg font-semibold text-ink-900">
            Likely Questions
          </h2>
          <p className="text-[0.8125rem] text-ink-600">The question every panel opens with, lines from the CV you sent, and questions common for this kind of role. Practise out loud, by voice or typing: it sticks better.</p>
        </div>
      </div>
      <ol className="stagger mt-4 space-y-3">
        {questions.map((q, i) => (
          <li key={q.id} style={{ ["--i" as string]: i }}>
            <QuestionCard
              n={i + 1}
              q={q}
              open={open === q.id}
              onToggle={() => setOpen(open === q.id ? null : q.id)}
              applicationId={applicationId}
              voice={voice}
              tries={attempts.filter((a) => a.questionId === q.id).length}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function QuestionCard({ n, q, open, onToggle, applicationId, voice, tries }: { n: number; q: ShortlistQuestion; open: boolean; onToggle: () => void; applicationId: string; voice: boolean; tries: number }) {
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState<"voice" | "text">("text");
  const [result, setResult] = useState<DrillAttempt | null>(null);
  const [count, setCount] = useState(tries);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const panel = `q-panel-${q.id}`;

  function submit() {
    setError(null);
    start(async () => {
      const res = await submitDrill(applicationId, { questionId: q.id, answer, mode });
      if (res.ok) {
        setResult(res.attempt);
        setCount((c) => c + 1);
      } else setError(res.error);
    });
  }

  return (
    <article className={`rounded-[var(--radius-card)] border bg-white shadow-card transition-colors ${open ? "border-brand-200" : "border-ink-150"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panel} className="flex w-full items-start gap-3.5 p-4 text-left lg:p-5">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${count ? "bg-proof-50 text-proof-700" : "bg-ink-75 text-ink-700"}`}>{count ? <TickCircle size={18} variant="bulk" /> : n}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">{KIND[q.kind]}</span>
          <span className="mt-1 block text-[0.9375rem] font-semibold leading-6 text-ink-900">{q.question}</span>
          {count ? <span className="mt-1 block text-xs text-ink-500">Practised {count === 1 ? "once" : `${count} times`}</span> : null}
        </span>
        <ArrowDown2 size={18} className={`mt-1 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div id={panel} className="animate-rise space-y-4 border-t border-ink-100 p-4 lg:p-5">
          <p className="flex items-start gap-2 text-[0.8125rem] leading-5 text-ink-600">
            <Lamp size={16} className="mt-0.5 shrink-0 text-care-600" />
            {q.why}
          </p>
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-[0.8125rem] leading-5 text-brand-900">
            <span className="font-semibold">How to answer: </span>
            {ANSWER_TIPS[q.kind]}
          </p>
          {q.bulletText ? (
            <div className="torn-edge rounded-t-2xl bg-paper p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                <DocumentText size={14} />
                On the CV you sent
              </p>
              <p className="mt-1 text-sm leading-6 text-ink-800">{q.bulletText}</p>
            </div>
          ) : null}

          {result ? (
            <Feedback r={result} onAgain={() => { setResult(null); setAnswer(""); }} />
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
              <label htmlFor={`a-${q.id}`} className={`block text-sm font-semibold text-ink-900 ${voice ? "mt-4" : ""}`}>
                {voice ? "Your answer (what you said appears here: fix any words before you check it)" : "Your answer"}
              </label>
              <textarea
                id={`a-${q.id}`}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                maxLength={6000}
                placeholder="Answer the way you'd say it in the room"
                className="mt-2 w-full resize-y rounded-2xl border border-ink-200 bg-white p-4 text-[0.9375rem] leading-6 text-ink-900 placeholder:text-ink-350 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {error ? (
                <p role="alert" className="mt-2 text-sm text-flag-700">
                  {error}
                </p>
              ) : null}
              <Button className="mt-3 w-full sm:w-auto" onClick={submit} disabled={busy || answer.trim().length < 15} aria-busy={busy || undefined}>
                {busy ? "Checking against your CV…" : "Check my answer"}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function Feedback({ r, onAgain }: { r: DrillAttempt; onAgain: () => void }) {
  const m = MATCH[r.matches];
  const Icon = m.icon;
  return (
    <div className="animate-pop space-y-4" role="status">
      <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${m.cls}`}>
        <Icon size={18} variant="bulk" />
        {m.label}
      </p>
      {r.didWell ? <p className="text-sm text-ink-700">{r.didWell}</p> : null}
      {r.issues.length ? (
        <ul className="space-y-2">
          {r.issues.map((i) => (
            <li key={i.detail} className={`flex items-start gap-2 rounded-xl p-3 text-[0.8125rem] leading-5 ${i.type === "contradicts_cv" ? "bg-flag-50 text-flag-700" : "bg-care-50 text-care-700"}`}>
              {i.type === "contradicts_cv" ? <Danger size={16} className="mt-0.5 shrink-0" /> : <Warning2 size={16} className="mt-0.5 shrink-0" />}
              {i.detail}
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">A stronger answer covers</h4>
        <ol className="mt-2 space-y-1.5">
          {r.points.map((p, i) => (
            <li key={p} className="flex gap-2.5 text-sm leading-6 text-ink-800">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[0.6875rem] font-semibold text-brand-700">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-ink-500">Points, not a script. Say it in your own words.</p>
      </div>
      <Button variant="secondary" onClick={onAgain}>
        <Repeat size={18} />
        Try again
      </Button>
    </div>
  );
}
