import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { captureJob, type CaptureInput } from "@/lib/jobs/capture";
import { allow } from "@/lib/rate-limit";

/**
 * Android share target (manifest share_target). Sharing a WhatsApp flyer or a job
 * link from any app lands here and opens the review screen for that job.
 */
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(`${origin}/sign-in`, 303);
  if (viewer.preview) return NextResponse.redirect(`${origin}/jobs/demo`, 303);
  if (!(await allow("job_parse"))) return NextResponse.redirect(`${origin}/jobs/new?error=busy`, 303);

  const form = await request.formData();
  const file = form.get("file");
  const text = [form.get("title"), form.get("text")].filter((v): v is string => typeof v === "string" && Boolean(v.trim())).join("\n\n");
  const url = String(form.get("url") ?? "").trim() || text.match(/https?:\/\/\S+/)?.[0] || "";

  let input: CaptureInput | null = null;
  if (file instanceof File && file.size > 0 && file.size <= 4 * 1024 * 1024) {
    const bytes = Buffer.from(await file.arrayBuffer());
    input = file.type.startsWith("image/") ? { mode: "screenshot", bytes, type: file.type } : { mode: "file", bytes, name: file.name, type: file.type };
  } else if (text.replace(url, "").trim().length >= 80) {
    input = { mode: "paste", text };
  } else if (url) {
    input = { mode: "link", url };
  }
  if (!input) return NextResponse.redirect(`${origin}/jobs/new`, 303);

  const result = await captureJob(await createClient(), viewer.id, viewer.targetMarkets, input);
  if (!result.ok) return NextResponse.redirect(`${origin}/jobs/new?via=${result.fallback ?? "paste"}&error=share`, 303);
  return NextResponse.redirect(`${origin}/jobs/${result.jobId}`, 303);
}
