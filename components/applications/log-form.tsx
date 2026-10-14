"use client";

import { toast } from "@/components/ui/toaster";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { attachFile } from "@/lib/client/upload";
import { UPLOAD_MAX_BYTES, sizeLabel, tooBigMessage } from "@/lib/uploads/limits";
import { DocumentUpload, TickCircle, Trash, Danger, ArrowRight } from "@/components/icons";

const CHANNELS = [
  { id: "email", label: "By email" },
  { id: "form", label: "Online form" },
  { id: "portal", label: "Their website" },
  { id: "other", label: "Another way" },
] as const;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

/**
 * Save an application you already sent, with the CV you made somewhere else. We keep the
 * job and that exact file, then check in and help you prepare like any other application.
 */
export function LogForm({ inModal = false }: { inModal?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [employer, setEmployer] = useState("");
  const [post, setPost] = useState("");
  const [link, setLink] = useState("");
  const [sentOn, setSentOn] = useState(today());
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["id"]>("email");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Saving needs the job (post or link) and the exact CV that went; title and employer are read from the job.
  const hasJob = post.trim().length >= 80 || /^https?:\/\/\S+\.\S+/.test(link.trim());
  const ready = hasJob && Boolean(file) && Boolean(sentOn);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (f.size > UPLOAD_MAX_BYTES) {
      setError(tooBigMessage(f.size, "save it as a smaller PDF"));
      return;
    }
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      setError("Use the CV as a PDF or a Word file (.docx).");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("title", title);
    body.append("employer", employer);
    if (post.trim()) body.append("post", post);
    if (link.trim()) body.append("link", link.trim());
    body.append("sent_on", sentOn);
    body.append("channel", channel);
    try {
      if (file) {
        const attached = await attachFile(body, file);
        if (!attached.ok) {
          setError(attached.error);
          return;
        }
      }
      const res = await fetch("/api/applications/log", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; applicationId?: string; error?: string };
      if (!data.ok || !data.applicationId) {
        setError(data.error ?? "That didn't work on our side. Try again in a moment.");
        return;
      }
      if (inModal) router.back();
      toast("Application saved. We'll check in with you.");
      setTimeout(() => router.push(`/applications/${data.applicationId}`), inModal ? 60 : 0);
    } catch {
      setError("You seem to be offline. Try again when you're connected.");
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-flag-50 p-3.5 text-sm text-flag-700">
          <Danger size={18} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-ink-900">
          The job post <span className="font-normal text-ink-500">(paste it, or add the link below)</span>
        </span>
        <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={4} className={`${inputClass} resize-y py-3 leading-6`} placeholder="Paste the job description. We keep a copy, even if the advert is taken down, and use it for interview prep." />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-ink-900">
          Or the link to the job <span className="font-normal text-ink-500">(we read the post from it)</span>
        </span>
        <input value={link} onChange={(e) => setLink(e.target.value)} type="url" inputMode="url" className={inputClass} placeholder="https://" />
      </label>

      <div>
        <p className="text-sm font-semibold text-ink-900">
          The CV you sent <span className="font-normal text-ink-500">(PDF or Word)</span>
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative mt-2 rounded-[18px] border-2 border-dashed p-5 text-center transition-all ${dragging ? "scale-[1.01] border-brand-500 bg-brand-50" : file ? "border-proof-600 bg-proof-50/50" : "border-ink-200 bg-ink-50"}`}
        >
          {file ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg bg-flag-50 text-flag-600 ring-1 ring-flag-100 hover:bg-flag-100"
                aria-label={`Remove ${file.name}`}
              >
                <Trash size={20} />
              </button>
              <div className="flex items-center justify-center gap-3 pr-10 text-left">
                <TickCircle size={26} variant="bulk" className="shrink-0 text-proof-600" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink-900">{file.name}</span>
                  <span className="text-[0.8125rem] text-ink-500">{sizeLabel(file.size)} · ready</span>
                </span>
              </div>
            </>
          ) : (
            <>
              <DocumentUpload size={28} variant="bulk" className="mx-auto text-brand-600" />
              <p className="mt-2 font-semibold text-ink-900">{dragging ? "Drop it here" : "Drag your CV here, or choose the file"}</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 shadow-card hover:bg-brand-50">
                Choose a file
              </button>
            </>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="sr-only" tabIndex={-1} aria-label="Choose the CV you sent" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink-900">
            Job title <span className="font-normal text-ink-500">(optional)</span>
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="We read it from the job" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink-900">
            Employer <span className="font-normal text-ink-500">(optional)</span>
          </span>
          <input value={employer} onChange={(e) => setEmployer(e.target.value)} className={inputClass} placeholder="We read it from the job" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink-900">The day you sent it</span>
          <input type="date" value={sentOn} max={today()} onChange={(e) => setSentOn(e.target.value)} className={inputClass} />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold text-ink-900">How you applied</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <label key={c.id} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium ring-1 ${channel === c.id ? "bg-brand-900 text-white ring-brand-900" : "bg-white text-ink-700 ring-ink-150 hover:bg-ink-50"}`}>
                <input type="radio" name="channel" value={c.id} checked={channel === c.id} onChange={() => setChannel(c.id)} className="sr-only" />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!ready || busy} aria-busy={busy || undefined}>
        {busy ? (link.trim() && post.trim().length < 80 ? "Reading the job and saving…" : "Saving…") : "Save this application"}
        {!busy ? <ArrowRight size={20} /> : null}
      </Button>
    </form>
  );
}
