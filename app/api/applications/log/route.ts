import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { takeUpload } from "@/lib/uploads/take";
import { UPLOAD_MAX_BYTES, tooBigMessage } from "@/lib/uploads/limits";
import { logExternalApplication } from "@/lib/applications/log";

const fields = z.object({
  title: z.string().trim().min(2, "Add the job title.").max(160),
  employer: z.string().trim().min(2, "Add the employer's name.").max(160),
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
    title: form.get("title"),
    employer: form.get("employer"),
    post: form.get("post") || undefined,
    link: form.get("link") || undefined,
    sent_on: form.get("sent_on"),
    channel: form.get("channel") || "other",
  });
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  const sent = new Date(`${parsed.data.sent_on}T12:00:00+01:00`);
  if (sent.getTime() > Date.now() + 86_400_000) return NextResponse.json({ ok: false, error: "The day you sent it can't be in the future." }, { status: 400 });

  const supabase = await createClient();
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

  const res = await logExternalApplication(supabase, viewer, {
    title: parsed.data.title,
    employer: parsed.data.employer,
    post: parsed.data.post ?? null,
    link: parsed.data.link ?? null,
    sentOn: parsed.data.sent_on,
    channel: parsed.data.channel,
    cv,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
