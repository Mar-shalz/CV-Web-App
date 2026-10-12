"use client";

import { useActionState, useEffect, useRef, useState, type DragEvent } from "react";
import { captureJob, type CaptureState } from "@/app/(app)/jobs/actions";
import { DocumentText, DocumentUpload, Link21, Gallery, ArrowRight, CloseCircle, TickCircle } from "@/components/icons";
import { Field, FieldError, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
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

export function CaptureForm({ initialMode = "paste" }: { initialMode?: Mode }) {
  const [state, action] = useActionState<CaptureState, FormData>(captureJob, undefined);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tried, setTried] = useState(false);
  const [dragging, setDragging] = useState(false);
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
  const fieldError = local ?? state?.fieldErrors?.text ?? state?.fieldErrors?.url;

  const accept = mode === "file" ? ".pdf,.doc,.docx,.txt" : "image/*";
  function pick(f: File | undefined | null) {
    if (!f) return;
    const max = (mode === "file" ? 5 : 8) * 1024 * 1024;
    if (f.size > max) {
      setFile(null);
      setTried(true);
      return;
    }
    setFile(f);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormError message={state?.error} />
      <input type="hidden" name="source_type" value={mode} />

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
                <div className="flex items-center justify-center gap-3 text-left">
                  <span className="grid size-12 place-items-center rounded-2xl bg-white text-proof-600 shadow-card">
                    <TickCircle size={24} variant="bulk" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink-900">{file.name}</span>
                    <span className="text-[0.8125rem] text-ink-500">{(file.size / 1024).toFixed(0)}KB · ready</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-2 grid size-12 place-items-center rounded-xl text-ink-500 hover:bg-white hover:text-ink-900"
                    aria-label={`Remove ${file.name}`}
                  >
                    <CloseCircle size={22} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-card">
                    {mode === "file" ? <DocumentUpload size={28} variant="bulk" /> : <Gallery size={28} variant="bulk" />}
                  </span>
                  <p className="mt-3 font-semibold text-ink-900">{mode === "file" ? "Drop the job description here" : "Drop a screenshot here"}</p>
                  <p className="mt-1 text-[0.8125rem] text-ink-500">
                    {mode === "file" ? "PDF, Word or text file, up to 5MB" : "WhatsApp and Instagram flyers work. Make sure the text is readable."}
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
        <SubmitButton size="lg" className="mt-3 w-full shrink-0 sm:mt-0 sm:w-auto" pendingLabel="Reading the job" inactive={!ready} onInactiveClick={() => setTried(true)}>
          Check this job
          <ArrowRight size={20} />
        </SubmitButton>
      </div>
    </form>
  );
}
