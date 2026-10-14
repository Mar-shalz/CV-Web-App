import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { takeUpload } from "@/lib/uploads/take";
import { UPLOAD_MAX_BYTES, tooBigMessage } from "@/lib/uploads/limits";
import { logExternalApplication } from "@/lib/applications/log";
import type { CaptureInput } from "@/lib/jobs/capture";

const fields = z.object({
  // Optional: read from the job post or link when left empty.
  title: z.string().trim().max(160).optional(),
  employer: z.string().trim().max(160).optional(),
  post: z.string().trim().max(60_000).optional(),
  link: z
    .string()
    .trim()
    .max(400)
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), "Paste the full link, starting with https://"),
  sent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the day you sent it."),
  channel: z.enum(["email", "form", "portal", "other"]),
});

/** Saves an application someone already sent, with the CV file they used. */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  if (viewer.preview) return NextResponse.json({ ok: true, applicationId: "s1" });
  if (!(await allow("job_parse"))) return NextResponse.json({ ok: false, error: RATE_LIMITED_MESSAGE }, { status: 429 });

  const form = await request.formData();
  const parsed = fields.safeParse({
    title: form.get("title") || undefined,
    employer: form.get("employer") || undefined,
    post: form.get("post") || undefined,
    link: form.get("link") || undefined,
    sent_on: form.get("sent_on"),
    channel: form.get("channel") || "other",
  });
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  const supabase = await createClient();
  // The job post as a photo, screenshot or file (D-129): read like one added for tailoring.
  let jobFile: Extract<CaptureInput, { mode: "file" | "screenshot" }> | null = null;
  const jobPath = form.get("job_upload_path");
  const jobBlob = form.get("job_file");
  if (typeof jobPath === "string" && jobPath) {
    const got = await takeUpload(supabase, viewer.id, jobPath);
    if ("error" in got) return NextResponse.json({ ok: false, error: got.error }, { status: 400 });
    jobFile = got.type.startsWith("image/") ? { mode: "screenshot", bytes: got.bytes, type: got.type } : { mode: "file", bytes: got.bytes, name: String(form.get("job_upload_name") ?? "job"), type: got.type };
  } else if (jobBlob instanceof File && jobBlob.size > 0) {
    if (jobBlob.size > UPLOAD_MAX_BYTES) return NextResponse.json({ ok: false, error: tooBigMessage(jobBlob.size) }, { status: 413 });
    const bytes = Buffer.from(await jobBlob.arrayBuffer());
    jobFile = jobBlob.type.startsWith("image/") ? { mode: "screenshot", bytes, type: jobBlob.type } : { mode: "file", bytes, name: jobBlob.name, type: jobBlob.type };
  }
  // The record is only useful with the job and the exact CV that went (D-107).
  if (!((parsed.data.post?.length ?? 0) >= 80 || parsed.data.link || jobFile)) return NextResponse.json({ ok: false, error: "Add the job: paste the post, add its link, or a photo or PDF of it." }, { status: 400 });
  const sent = new Date(`${parsed.data.sent_on}T12:00:00+01:00`);
  if (sent.getTime() > Date.now() + 86_400_000) return NextResponse.json({ ok: false, error: "The day you sent it can't be in the future." }, { status: 400 });

  let cv: { bytes: Buffer; name: string; type: string } | null = null;
  const file = form.get("file");
  const uploadPath = form.get("upload_path");
  if (typeof uploadPath === "string" && uploadPath) {
    const got = await takeUpload(supabase, viewer.id, uploadPath);
    if ("error" in got) return NextResponse.json({ ok: false, error: got.error }, { status: 400 });
    cv = { bytes: got.bytes, name: String(form.get("upload_name") ?? "CV"), type: got.type };
  } else if (file instanceof File && file.size > 0) {
    if (file.size > UPLOAD_MAX_BYTES) return NextResponse.json({ ok: false, error: tooBigMessage(file.size) }, { status: 413 });
    cv = { bytes: Buffer.from(await file.arrayBuffer()), name: file.name, type: file.type };
  }
  if (!cv) return NextResponse.json({ ok: false, error: "Add the CV you sent, as a PDF or Word file." }, { status: 400 });

  const res = await logExternalApplication(supabase, viewer, {
    title: parsed.data.title ?? "",
    employer: parsed.data.employer ?? "",
    post: parsed.data.post ?? null,
    link: parsed.data.link ?? null,
    jobFile,
    sentOn: parsed.data.sent_on,
    channel: parsed.data.channel,
    cv,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
