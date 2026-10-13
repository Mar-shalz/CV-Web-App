"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/client/compress-image";
import { DocumentText, DocumentUpload, Link21, Gallery, ArrowRight, TickCircle, Trash } from "@/components/icons";
import { attachFile } from "@/lib/client/upload";
import { UPLOAD_MAX_BYTES, sizeLabel, tooBigMessage } from "@/lib/uploads/limits";
import { LIMITS } from "@/lib/config";
import { Field, FieldError, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/auth/form-error";

type Mode = "paste" | "file" | "link" | "screenshot";

const MODES: { id: Mode; label: string; icon: typeof DocumentText }[] = [
  { id: "paste", label: "Paste text", icon: DocumentText },
  { id: "file", label: "Upload file", icon: DocumentUpload },
  { id: "link", label: "Paste a link", icon: Link21 },
  { id: "screenshot", label: "Screenshot", icon: Gallery },
];

const MIN_TEXT = 80;
const DRAFT_KEY = "capture-draft-v1";

const STEPS = ["Reading the job", "Finding the requirements", "Checking how to apply"];

export function CaptureForm({ initialMode = "paste", initialError }: { initialMode?: Mode; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState<string | undefined>(initialError);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tried, setTried] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  // Never lose input: the draft lives on this phone until the job is saved. It is
  // restored after hydration (the server can't see localStorage), hence the effect.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      /* eslint-disable react-hooks/set-state-in-effect */
      if (d?.text) setText(d.text);
      if (d?.url) setUrl(d.url);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, url }));
    } catch {}
  }, [text, url]);

  const urlOk = /^https?:\/\/\S+\.\S+/.test(url.trim());
  const ready = mode === "paste" ? text.trim().length >= MIN_TEXT : mode === "link" ? urlOk : Boolean(file);
  const local =
    tried && !ready
      ? mode === "paste"
        ? text.trim()
          ? "This looks a bit short. Paste the whole job description, including requirements and how to apply."
          : "Paste the job description first."
        : mode === "link"
          ? "Enter a full link, starting with https://"
          : "Choose a file first."
      : undefined;
  const fieldError = sizeError ?? local;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) {
      setTried(true);
      return;
    }
    setError(undefined);
    setBusy(true);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);
    const body = new FormData();
    body.append("mode", mode);
    if (mode === "paste") body.append("text", text);
    if (mode === "link") body.append("url", url);
    if ((mode === "file" || mode === "screenshot") && file) {
      const attached = await attachFile(body, mode === "screenshot" ? await compressImage(file) : file);
      if (!attached.ok) {
        clearInterval(timer);
        setBusy(false);
        setError(attached.error);
        return;
      }
    }
    try {
      const res = await fetch("/api/jobs/capture", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; jobId?: string; error?: string; fallback?: Mode };
      if (!data.ok || !data.jobId) {
        setError(data.error ?? "Something went wrong. Try again.");
        // A link behind a login: move to paste or screenshot without losing anything.
        if (data.fallback && mode === "link") setMode(data.fallback);
        return;
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.push(`/jobs/${data.jobId}`);
    } catch {
      setError("You seem to be offline. Your text is saved on this phone; try again when you're connected.");
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  const accept = mode === "file" ? ".pdf,.doc,.docx,.txt" : "image/*";
  function pick(f: File | undefined | null) {
    // Cancelling the file picker gives no file: keep whatever was there.
    if (!f) return;
    if (f.size > UPLOAD_MAX_BYTES) {
      setFile(null);
      setSizeError(tooBigMessage(f.size, mode === "file" ? "paste the text instead" : "take a smaller screenshot"));
      return;
    }
    setSizeError(undefined);
    setFile(f);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error} />

      <fieldset>
        <legend className="text-sm font-semibold text-ink-900">How do you want to add it?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map(({ id, label, icon: Icon }) => {
            const on = mode === id;
            return (
              <label
                key={id}
                className={`flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-sm font-medium transition-all duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500 ${
                  on ? "border-brand-500 bg-brand-50 text-brand-800 shadow-[0_0_0_4px_rgb(52_97_240/0.10)]" : "border-transparent bg-ink-75 text-ink-600 hover:bg-ink-100"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={id}
                  checked={on}
                  onChange={() => {
                    setMode(id);
                    setSizeError(undefined);
                    setTried(false);
                    setFile(null);
                  }}
                  className="sr-only"
                />
                <Icon size={24} variant={on ? "bulk" : "linear"} />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div key={mode} className="animate-rise">
        {mode === "paste" ? (
          <Field id="text" label="Job description" error={fieldError} hint={`${text.trim().length.toLocaleString("en-NG")} characters. Include the requirements and how to apply.`}>
            <textarea
              id="text"
              name="text"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the whole job post here: the role, what they're looking for, and how to apply."
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "text-error" : "text-hint"}
              className={`${inputClass} min-h-[240px] resize-y py-4 leading-6`}
            />
          </Field>
        ) : null}

        {mode === "link" ? (
          <Field id="url" label="Link to the job post" error={fieldError} hint="Some sites, like LinkedIn, need a login. If we can't open the link, you can paste the text instead without starting over.">
            <input
              id="url"
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "url-error" : "url-hint"}
              className={inputClass}
            />
          </Field>
        ) : null}

        {mode === "file" || mode === "screenshot" ? (
          <div>
            <p className="text-sm font-semibold text-ink-900">{mode === "file" ? "Job description file" : "Screenshot or photo of the job"}</p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mt-2 rounded-[22px] border-2 border-dashed p-6 text-center transition-all duration-200 ${
                dragging ? "scale-[1.01] border-brand-500 bg-brand-50" : file ? "border-proof-600 bg-proof-50/50" : "border-ink-200 bg-ink-50 hover:border-brand-300"
              }`}
            >
              {file ? (
                <div className="relative animate-pop">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="absolute -right-3 -top-3 grid size-10 place-items-center rounded-lg bg-flag-50 text-flag-600 ring-1 ring-flag-100 transition-colors hover:bg-flag-100 hover:text-flag-700"
                    aria-label={`Remove ${file.name}`}
                  >
                    <Trash size={20} />
                  </button>
                  <div className="flex items-center justify-center gap-3 pr-8 text-left">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-proof-600 shadow-card">
                      <TickCircle size={24} variant="bulk" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink-900">{file.name}</span>
                      <span className="text-[0.8125rem] text-ink-500">{sizeLabel(file.size)} · ready</span>
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-card">
                    {mode === "file" ? <DocumentUpload size={28} variant="bulk" /> : <Gallery size={28} variant="bulk" />}
                  </span>
                  <p className="mt-3 font-semibold text-ink-900">{mode === "file" ? "Drop the job description here" : "Drop a screenshot here"}</p>
                  <p className="mt-1 text-[0.8125rem] text-ink-500">
                    {mode === "file" ? `PDF, Word or text file, up to ${LIMITS.files.upload_max_mb}MB` : `WhatsApp and Instagram flyers work, up to ${LIMITS.files.upload_max_mb}MB. Make sure the text is readable.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-white px-5 text-sm font-semibold text-brand-700 shadow-card hover:bg-brand-50"
                  >
                    {mode === "file" ? "Choose a file" : "Choose a photo"}
                  </button>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="sr-only"
                tabIndex={-1}
                aria-label={mode === "file" ? "Choose a job description file" : "Choose a screenshot"}
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>
            {fieldError ? (
              <div className="mt-2">
                <FieldError>{fieldError}</FieldError>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-ink-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-[0.8125rem] leading-5 text-ink-600">
          Next, we check if you qualify and if the job looks genuine. <span className="font-semibold text-ink-900">Free, even after your trial.</span>
        </p>
        <Button type="submit" size="lg" className="mt-3 w-full shrink-0 sm:mt-0 sm:w-auto" aria-disabled={!ready || busy || undefined} aria-busy={busy || undefined}>
          {busy ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
              <span aria-live="polite">{STEPS[step]}</span>
            </>
          ) : (
            <>
              Check this job
              <ArrowRight size={20} />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
