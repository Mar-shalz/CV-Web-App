"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentUpload, Camera, DocumentText, TickCircle, Danger, ArrowRight, Edit2 } from "./icons";
import { compressImage } from "@/lib/client/compress-image";
import { inputClass } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";

type Mode = "file" | "photo" | "text";
type Phase = { kind: "idle" } | { kind: "working"; step: number } | { kind: "error"; message: string; manual: boolean };

const STEPS = ["Uploading", "Reading every page", "Finding your roles and achievements", "Getting them ready for you to check"];

export function ImportPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function send(body: FormData) {
    setPhase({ kind: "working", step: 0 });
    // The parse takes 10 to 30 seconds; move the steps along so people can see it working.
    let step = 0;
    const timer = setInterval(() => setPhase({ kind: "working", step: (step = Math.min(step + 1, STEPS.length - 1)) }), 4500);
    try {
      const res = await fetch("/api/vault/import", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; error?: string; manual?: boolean; sensitiveSkipped?: boolean };
      if (!data.ok) {
        setPhase({ kind: "error", message: data.error ?? "Something went wrong. Try again.", manual: Boolean(data.manual) });
        return;
      }
      router.push(`/vault/review${data.sensitiveSkipped ? "?sensitive=1" : ""}`);
    } catch {
      setPhase({ kind: "error", message: "You seem to be offline. Your file is still on your phone; try again when you're connected.", manual: false });
    } finally {
      clearInterval(timer);
    }
  }

  async function onFile(file: File | undefined, photo: boolean) {
    if (!file) return;
    const ready = photo ? await compressImage(file) : file;
    if (ready.size > 4 * 1024 * 1024) {
      setPhase({ kind: "error", message: "That file is too big. Use one under 4MB, or paste the text instead.", manual: false });
      return;
    }
    const body = new FormData();
    body.append("file", ready);
    await send(body);
  }

  if (phase.kind === "working") {
    return (
      <div className="animate-pop rounded-[var(--radius-panel)] border border-brand-100 bg-gradient-to-b from-brand-50 to-white p-6 text-center lg:p-10" role="status" aria-live="polite">
        <div className="relative mx-auto h-36 w-28 overflow-hidden rounded-xl border border-paper-edge bg-paper shadow-raised" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="mx-3 mt-3 block h-2 rounded-full bg-ink-150" style={{ width: `${60 + ((i * 17) % 30)}%` }} />
          ))}
          <span className="absolute inset-x-0 top-0 h-10 animate-[scan_1.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-brand-400/30 to-transparent" />
        </div>
        <p className="mt-6 text-lg font-semibold text-ink-900">{STEPS[phase.step]}</p>
        <p className="mt-1 text-sm text-ink-600">This usually takes about 20 seconds. Keep this page open.</p>
        <ol className="mx-auto mt-5 flex max-w-xs justify-center gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= phase.step ? "bg-brand-600" : "bg-ink-150"}`} />
          ))}
        </ol>
      </div>
    );
  }

  const tabs: { id: Mode; label: string; icon: typeof DocumentUpload }[] = [
    { id: "file", label: "PDF or Word", icon: DocumentUpload },
    { id: "photo", label: "Photo of CV", icon: Camera },
    { id: "text", label: "Paste text", icon: DocumentText },
  ];

  return (
    <div className="space-y-5">
      {phase.kind === "error" ? (
        <div role="alert" className="flex animate-rise flex-col gap-3 rounded-2xl bg-flag-50 p-4 text-sm text-flag-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 font-medium">
            <Danger size={20} variant="bulk" className="mt-px shrink-0" />
            {phase.message}
          </p>
          {phase.manual ? (
            <ButtonLink href="/vault/new" variant="secondary" size="sm" className="shrink-0">
              <Edit2 size={18} />
              Add by hand
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How to add your CV">
        {tabs.map(({ id, label, icon: Icon }) => {
          const on = mode === id;
          return (
            <label
              key={id}
              className={`flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-center text-sm font-medium transition-all duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500 ${
                on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-transparent bg-ink-75 text-ink-600 hover:bg-ink-100"
              }`}
            >
              <input type="radio" name="import-mode" checked={on} onChange={() => setMode(id)} className="sr-only" />
              <Icon size={24} variant={on ? "bulk" : "linear"} />
              {label}
            </label>
          );
        })}
      </div>

      <div key={mode} className="animate-rise">
        {mode === "text" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const body = new FormData();
              body.append("text", text);
              void send(body);
            }}
          >
            <label htmlFor="cv-text" className="text-sm font-semibold text-ink-900">
              Your CV text
            </label>
            <textarea
              id="cv-text"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Copy everything from your CV and paste it here."
              className={`${inputClass} min-h-[220px] resize-y py-4 leading-6`}
            />
            <Button type="submit" size="lg" className="w-full" aria-disabled={text.trim().length < 40 || undefined} disabled={text.trim().length < 40}>
              Read my CV
              <ArrowRight size={20} />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => (mode === "file" ? fileRef : photoRef).current?.click()}
            className="group flex w-full flex-col items-center rounded-[22px] border-2 border-dashed border-ink-200 bg-ink-50 p-8 text-center transition-all duration-200 hover:border-brand-400 hover:bg-brand-50"
          >
            <span className="grid size-16 place-items-center rounded-2xl bg-white text-brand-600 shadow-card transition-transform duration-300 group-hover:-translate-y-1">
              {mode === "file" ? <DocumentUpload size={32} variant="bulk" /> : <Camera size={32} variant="bulk" />}
            </span>
            <span className="mt-4 text-base font-semibold text-ink-900">{mode === "file" ? "Choose your CV file" : "Take or choose a photo"}</span>
            <span className="mt-1 text-[0.8125rem] text-ink-500">
              {mode === "file" ? "PDF or Word (.docx), up to 4MB" : "One page per photo, flat and well lit. We shrink it to save your data."}
            </span>
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf" className="sr-only" tabIndex={-1} aria-label="Choose a CV file" onChange={(e) => onFile(e.target.files?.[0], false)} />
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Take a photo of your CV" onChange={(e) => onFile(e.target.files?.[0], true)} />

      <p className="flex items-start gap-2 text-[0.8125rem] leading-5 text-ink-500">
        <TickCircle size={16} className="mt-0.5 shrink-0" />
        We read your file once and don&apos;t keep it. Only what you confirm is saved.
      </p>
    </div>
  );
}
