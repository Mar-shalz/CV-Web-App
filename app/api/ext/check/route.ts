import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extAllow, extUser } from "@/lib/ext/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fullCheck, quickCheck } from "@/lib/legitimacy";
import { jobSchema, EMPTY_JOB } from "@/lib/jobs/schema";
import { DEMO_PARSED } from "@/lib/demo/job";

export const maxDuration = 90;

/** "Is this job real?" from inside the extension (D-144): the same checks as the app, shown in the side panel. */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const id = z.object({ jobId: z.string() }).safeParse(await request.json().catch(() => null));
  if (!id.success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (user.preview) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ ok: true, view: quickCheck("Graduate Trainee, Finance at Northbridge Bank", DEMO_PARSED) });
  }
  if (!z.uuid().safeParse(id.data.jobId).success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (!(await extAllow(user.id, "ext_check"))) return NextResponse.json({ ok: false, error: "You've checked a lot of jobs in the last hour. Try again soon." }, { status: 429 });
  const db = createAdminClient();
  const { data: job } = await db.from("jobs").select("id, parsed, raw_text, post_hash, source_url").eq("id", id.data.jobId).eq("user_id", user.id).maybeSingle();
  if (!job) return NextResponse.json({ ok: false, error: "We couldn't find that job." }, { status: 404 });
  const p = jobSchema.safeParse(job.parsed);
  const view = await fullCheck(db, { userId: user.id, jobId: job.id, postHash: job.post_hash, text: job.raw_text ?? "", job: p.success ? p.data : EMPTY_JOB, sourceUrl: job.source_url });
  return NextResponse.json({ ok: true, view });
}
