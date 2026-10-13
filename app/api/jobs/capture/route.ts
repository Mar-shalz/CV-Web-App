import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { captureJob } from "@/lib/jobs/capture";
import { readCaptureForm } from "@/lib/jobs/read-upload";
import { takeUpload } from "@/lib/uploads/take";
import { track } from "@/lib/analytics/server";

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  if (viewer.preview) return NextResponse.json({ ok: true, jobId: "demo" });
  if (!(await allow("job_parse"))) return NextResponse.json({ ok: false, error: RATE_LIMITED_MESSAGE }, { status: 429 });

  const supabase = await createClient();
  const input = await readCaptureForm(await request.formData(), (path) => takeUpload(supabase, viewer.id, path));
  if ("error" in input) return NextResponse.json({ ok: false, error: input.error }, { status: 400 });

  const result = await captureJob(supabase, viewer.id, viewer.targetMarkets, input);
  if (result.ok) await track("job_captured", { source_type: input.mode }, viewer.id);
  else await track("job_parse_failed", { source_type: input.mode, reason: result.fallback ?? "error" }, viewer.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
