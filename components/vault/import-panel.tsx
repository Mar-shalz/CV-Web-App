"use client";

import { useRef, useState } from "react";
import { WorkingNotice } from "@/components/ui/working-notice";
import { useRouter } from "next/navigation";
import { DocumentUpload, Camera, DocumentText, TickCircle, Danger, ArrowRight, Edit2 } from "./icons";
import { compressImage } from "@/lib/client/compress-image";
import { attachFile } from "@/lib/client/upload";
import { UPLOAD_MAX_BYTES, tooBigMessage } from "@/lib/uploads/limits";
import { LIMITS } from "@/lib/config";
import { inputClass, optionClass, optionOn, optionOff } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";

type Mode = "file" | "photo" | "text";
/** A second CV replaces what's saved or adds to it; the person chooses (D-184). */
type Plan = "replace" | "add";
type Phase = { kind: "idle" } | { kind: "working"; step: number } | { kind: "error"; message: string; manual: boolean };

const STEPS = ["Uploading", "Reading every page", "Finding your roles and achievements", "Getting them ready for you to check"];

export function ImportPanel({ savedRoles = 0 }: { savedRoles?: number }) {
  const [dragging, setDragging] = useState(false);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [nudge, setNudge] = useState(false);
  const ready = savedRoles === 0 || plan !== null;
  const planRef = useRef<HTMLFieldSetElement>(null);
  // Asked before anything is read, so nothing is replaced by surprise.
  const needPlan = () => {
    setNudge(true);
    planRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function send(body: FormData) {
    if (plan) body.append("plan", plan);
    setPhase({ kind: "working", step: 0 });
    // The parse takes 10 to 30 seconds; move the steps along so people can see it working.
    let step = 0;
    const timer = setInterval(() => setPhase({ kind: "working", step: (step = Math.min(step + 1, STEPS.length - 1)) }), 4500);
    try {
      const res = await fetch("/api/vault/import", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; error?: string; manual?: boolean; sensitiveSkipped?: boolean; replaced?: boolean; merged?: number };
      if (!data.ok) {
        setPhase({ kind: "error", message: data.error ?? "That didn't work on our side. Try again in a moment.", manual: Boolean(data.manual) });
        return;
      }
      const q = new URLSearchParams();
      if (data.sensitiveSkipped) q.set("sensitive", "1");
      if (savedRoles > 0) q.set("cv", data.replaced ? "replaced" : "added");
      if (data.merged) q.set("merged", String(data.merged));
      router.push(`/experience/review${q.size ? `?${q}` : ""}`);
    } catch {
      setPhase({ kind: "error", message: "You seem to be offline. Your file is still on your phone; try again when you're connected.", manual: false });
    } finally {
      clearInterval(timer);
    }
  }

  async function onFile(file: File | undefined, photo: boolean) {
    if (!file) return;
    if (!ready) return needPlan();
    const upload = photo ? await compressImage(file) : file;
    if (upload.size > UPLOAD_MAX_BYTES) {
      setPhase({ kind: "error", message: tooBigMessage(upload.size), manual: false });
      return;
    }
    const body = new FormData();
    const attached = await attachFile(body, upload);
    if (!attached.ok) {
      setPhase({ kind: "error", message: attached.error, manual: false });
      return;
    }
    await send(body);
  }

  if (phase.kind === "working") {
    return <WorkingNotice title="Reading your CV" steps={STEPS} estimate="Usually 15 to 40 seconds" stepSeconds={8} />;
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
            <ButtonLink href="/experience/new" variant="secondary" size="sm" className="shrink-0">
              <Edit2 size={18} />
              Add by hand
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {savedRoles > 0 ? (
        <fieldset ref={planRef} className="space-y-2.5">
          <legend className="text-[0.9375rem] font-semibold text-ink-900">You already have experience saved. What should this CV do?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: "replace", title: "Replace what I have", body: "Use this CV instead of what's saved. Best if you uploaded the wrong CV before." },
                { id: "add", title: "Add to what I have", body: "Keep what's saved and add anything new from this CV. Nothing is added twice." },
              ] as const
            ).map((o) => (
              <label key={o.id} className={`flex cursor-pointer flex-col gap-1 rounded-2xl p-4 ${optionClass}`}>
                <input
                  type="radio"
                  name="cv-plan"
                  value={o.id}
                  checked={plan === o.id}
                  onChange={() => {
                    setPlan(o.id);
                    setNudge(false);
                  }}
                  className="sr-only"
                />
                <span className="text-[0.9375rem] font-semibold">{o.title}</span>
                <span className="text-[0.8125rem] leading-5 text-ink-600">{o.body}</span>
              </label>
            ))}
          </div>
          {plan === "replace" ? (
            <p className="rounded-xl bg-care-50 p-3 text-[0.8125rem] leading-5 text-care-700">
              Your saved roles, achievements, summary, skills and referees are removed once this CV has been read, and can&apos;t be brought back. Skills you added while checking jobs stay.
            </p>
          ) : null}
          {nudge && !plan ? (
            <p role="alert" className="text-[0.8125rem] font-medium text-flag-700">
              Choose Replace or Add first.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How to add your CV">
        {tabs.map(({ id, label, icon: Icon }) => {
          const on = mode === id;
          return (
            <label
              key={id}
              className={`flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-center text-sm font-medium transition-all duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500 ${on ? optionOn : optionOff}`}
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
              if (!ready) return needPlan();
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
            onClick={() => (ready ? (mode === "file" ? fileRef : photoRef).current?.click() : needPlan())}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f, f.type.startsWith("image/"));
            }}
            className={`group flex w-full flex-col items-center rounded-[22px] border-2 border-dashed p-8 text-center transition-all duration-200 ${dragging ? "scale-[1.01] border-brand-500 bg-brand-50" : "border-ink-200 bg-ink-50 hover:border-brand-400 hover:bg-brand-50"}`}
          >
            <span className="grid size-16 place-items-center rounded-2xl bg-white text-brand-600 shadow-card transition-transform duration-300 group-hover:-translate-y-1">
              {mode === "file" ? <DocumentUpload size={32} variant="bulk" /> : <Camera size={32} variant="bulk" />}
            </span>
            <span className="mt-4 text-base font-semibold text-ink-900">{dragging ? "Drop it here" : mode === "file" ? "Drag your CV here, or choose a file" : "Take or choose a photo, or drag it here"}</span>
            <span className="mt-1 text-[0.8125rem] text-ink-500">
              {mode === "file" ? `PDF or Word (.docx), up to ${LIMITS.files.upload_max_mb}MB` : "One page per photo, flat and well lit. We shrink it to save your data."}
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
