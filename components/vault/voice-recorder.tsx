"use client";

import { useEffect, useRef, useState } from "react";
import { Microphone2, StopCircle, Refresh2 } from "@/components/icons";

const MAX_SECONDS = 120;
const QUEUE_KEY = "voice-queue-v1";

type State = { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "sending" } | { kind: "queued" } | { kind: "error"; message: string };

/**
 * Records one answer (up to 2 minutes, about 120KB a minute) and sends it for
 * transcription. Offline, the recording waits on this phone and goes when the
 * connection is back. Audio is never stored on our side.
 */
export function VoiceRecorder({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0.1));
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef(0);
  const pending = useRef<Blob | null>(null);

  async function upload(blob: Blob) {
    setState({ kind: "sending" });
    const body = new FormData();
    body.append("audio", blob, "answer.webm");
    try {
      const res = await fetch("/api/speech/transcribe", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; text?: string; error?: string };
      if (!data.ok || !data.text) {
        setState({ kind: "error", message: data.error ?? "We couldn't hear that clearly. Try again, or type your answer." });
        return;
      }
      pending.current = null;
      try {
        sessionStorage.removeItem(QUEUE_KEY);
      } catch {}
      onText(data.text);
      setState({ kind: "idle" });
    } catch {
      // Offline: keep the recording and send it when the network returns.
      pending.current = blob;
      try {
        sessionStorage.setItem(QUEUE_KEY, "1");
      } catch {}
      setState({ kind: "queued" });
    }
  }

  useEffect(() => {
    const retry = () => {
      if (pending.current) void upload(pending.current);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 16_000 } : { audioBitsPerSecond: 16_000 });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(raf.current);
        if (timer.current) clearInterval(timer.current);
        void upload(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
      };
      // Live level bars so people can see the phone hears them.
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevels(Array.from({ length: 24 }, (_, i) => Math.max(0.08, (data[i % data.length] ?? 0) / 255)));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      r.start(1000);
      rec.current = r;
      let seconds = 0;
      setState({ kind: "recording", seconds });
      timer.current = setInterval(() => {
        seconds++;
        setState({ kind: "recording", seconds });
        if (seconds >= MAX_SECONDS) r.stop();
      }, 1000);
    } catch {
      setState({ kind: "error", message: "We couldn't use your microphone. Allow it in your browser settings, or type your answer." });
    }
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (state.kind === "recording") {
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-flag-50 p-3 pr-4" aria-live="polite">
        <button
          type="button"
          onClick={() => rec.current?.stop()}
          className="grid size-14 shrink-0 place-items-center rounded-full bg-flag-600 text-white shadow-raised transition-transform active:scale-95"
          aria-label="Stop recording"
        >
          <StopCircle size={30} variant="bulk" />
        </button>
        <div className="flex h-10 flex-1 items-center gap-[3px]" aria-hidden="true">
          {levels.map((l, i) => (
            <span key={i} className="w-full rounded-full bg-flag-600/70 transition-[height] duration-75" style={{ height: `${Math.round(l * 100)}%` }} />
          ))}
        </div>
        <span className="tabular-nums text-sm font-semibold text-flag-700">
          {mmss(state.seconds)} <span className="font-normal text-flag-700/70">/ 2:00</span>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={disabled || state.kind === "sending"}
        className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 px-4 font-semibold text-brand-800 transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-ink-150 disabled:bg-ink-75 disabled:text-ink-400"
      >
        <span className="relative grid size-10 place-items-center rounded-full bg-brand-600 text-white group-disabled:bg-ink-300">
          <Microphone2 size={22} variant="bulk" />
        </span>
        {state.kind === "sending" ? "Writing down what you said" : "Tap to answer by voice"}
      </button>
      {state.kind === "queued" ? (
        <p className="flex items-center gap-2 text-[0.8125rem] text-care-700" role="status">
          <Refresh2 size={16} />
          You&apos;re offline. Your answer is saved on this phone and will send when you&apos;re back.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p className="text-[0.8125rem] text-flag-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
