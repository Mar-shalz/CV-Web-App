"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitDebrief } from "@/app/(app)/applications/[id]/debrief/actions";
import type { DebriefView } from "@/lib/applications/debrief";
import { VoiceRecorder } from "@/components/vault/voice-recorder";
import { Button } from "@/components/ui/button";
import { TickCircle, Danger, MessageQuestion, People, ArrowLeft2 } from "@/components/icons";

const PROMPTS = ["Which questions did they ask?", "Was it in person, video, phone or a test?", "Who was on the panel?", "Which question was hardest?"];
const FORMAT: Record<string, string> = { in_person: "In person", video: "Video call", phone: "Phone call", test: "Test", assessment_centre: "Assessment centre", unknown: "Format not clear" };
const TOPIC: Record<string, string> = { about_you: "About you", cv: "Your CV", technical: "Technical", situational: "Situational", motivation: "Why this job", salary: "Salary", other: "Other" };

/** Debrief (screen 20): voice or text, straight after the interview. */
export function DebriefForm({ applicationId, voice, existing }: { applicationId: string; voice: boolean; existing: DebriefView | null }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"voice" | "text">("text");
  const [share, setShare] = useState(false);
  const [result, setResult] = useState<DebriefView | null>(existing);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await submitDebrief(applicationId, { text, mode, share });
      if (res.ok) setResult(res.debrief);
      else setError(res.error);
    });
  }

  if (result) {
    return (
      <section className="animate-pop rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6" role="status">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-proof-50 text-proof-700">
            <TickCircle size={26} variant="bulk" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">Debrief saved</h2>
            <p className="text-sm text-ink-600">
              {FORMAT[result.format ?? "unknown"]}
              {result.panel ? ` · ${result.panel}` : ""}
            </p>
          </div>
        </div>
        {result.questions.length ? (
          <>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Questions you were asked</h3>
            <ol className="stagger mt-2 space-y-2">
              {result.questions.map((q, i) => (
                <li key={q.text} style={{ ["--i" as string]: i }} className="flex gap-3 rounded-2xl bg-ink-50 p-3.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-ink-700 shadow-card">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-ink-900">{q.text}</p>
                    <p className="text-xs text-ink-500">{TOPIC[q.topic] ?? "Other"}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-600">We kept your notes. We couldn&apos;t pick out separate questions this time.</p>
        )}
        <p className="mt-4 text-[0.8125rem] leading-5 text-ink-600">Good work writing this down. The next panel for a role like this will likely ask some of the same things.</p>
        <Link href={`/applications/${applicationId}`} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl border border-ink-200 px-5 font-semibold text-ink-900 hover:bg-ink-50">
          <ArrowLeft2 size={18} />
          Back to the application
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
      <ul className="flex flex-wrap gap-2" aria-label="Things to mention">
        {PROMPTS.map((p) => (
          <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[0.8125rem] font-medium text-brand-800">
            <MessageQuestion size={14} />
            {p}
          </li>
        ))}
      </ul>

      {voice ? (
        <div className="mt-5">
          <VoiceRecorder
            disabled={busy}
            onText={(t) => {
              setMode("voice");
              setText((cur) => (cur ? `${cur}\n${t}` : t));
            }}
          />
        </div>
      ) : null}

      <label htmlFor="debrief" className="mt-5 block text-sm font-semibold text-ink-900">
        {voice ? "Or type it" : "Tell us how it went"}
      </label>
      <textarea
        id="debrief"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={8000}
        placeholder="They asked me to introduce myself, then about my SIWES at the bank. It was 3 people on Zoom..."
        className="mt-2 w-full resize-y rounded-2xl border border-ink-200 bg-white p-4 text-[0.9375rem] leading-6 text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-50 p-4">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-600" />
        <span className="text-[0.8125rem] leading-5 text-ink-700">
          <span className="flex items-center gap-1.5 font-semibold text-ink-900">
            <People size={16} />
            Help others prepare (optional)
          </span>
          Add the questions, without your name or notes, to a question bank other graduates can practise with. You can change this later in Settings.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-flag-700">
          <Danger size={18} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
      <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={submit} disabled={busy || text.trim().length < 20} aria-busy={busy || undefined}>
        {busy ? "Saving…" : "Save my debrief"}
      </Button>
    </section>
  );
}
