import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extAllow, extUser } from "@/lib/ext/auth";
import { captureJob, type CaptureInput } from "@/lib/jobs/capture";
import { fetchJobImage } from "@/lib/jobs/fetch-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobSchema } from "@/lib/jobs/schema";
import { DEMO_PARSED } from "@/lib/demo/job";

// Reading a job can take a while when it comes from an image.
export const maxDuration = 60;

const body = z.object({
  text: z.string().max(60_000).optional(),
  url: z.string().max(2000).optional(),
  image: z.string().max(7_000_000).optional(),
  imageUrl: z.string().max(2000).optional(),
});

/**
 * The job on the page the extension is looking at (D-144): its text, a screenshot of the
 * screen, or a flyer image's address. Saved to the person's account like any job, and read
 * by the same parser. Page text is untrusted job post data.
 */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "We couldn't read that page. Try again." }, { status: 400 });
  const b = parsed.data;
  if (user.preview) return NextResponse.json({ ok: true, jobId: "demo", title: DEMO_PARSED.title, employer: DEMO_PARSED.employer_name, location: "Victoria Island, Lagos" });
  if (!(await extAllow(user.id, "ext_capture"))) return NextResponse.json({ ok: false, error: "You've sent a lot of jobs in the last hour. Try again soon." }, { status: 429 });

  const pageUrl = b.url && /^https?:\/\/\S+$/.test(b.url) ? b.url.slice(0, 400) : undefined;
  let input: CaptureInput | null = null;
  if (b.image) {
    const m = b.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return NextResponse.json({ ok: false, error: "That screenshot didn't come through. Try again." }, { status: 400 });
    const bytes = Buffer.from(m[2]!, "base64");
    if (bytes.length > 5_000_000) return NextResponse.json({ ok: false, error: "That screenshot is too big." }, { status: 413 });
    input = { mode: "screenshot", bytes, type: m[1]! };
  } else if (b.imageUrl) {
    const img = await fetchJobImage(b.imageUrl);
    if (!img.ok) return NextResponse.json({ ok: false, error: "We couldn't open that image. Try Scan the screen instead." }, { status: 400 });
    input = { mode: "screenshot", bytes: img.bytes, type: img.type };
  } else if ((b.text ?? "").trim().length >= 80) {
    input = { mode: "paste", text: b.text!.trim(), sourceUrl: pageUrl };
  } else if (pageUrl) {
    input = { mode: "link", url: pageUrl };
  }
  if (!input) return NextResponse.json({ ok: false, error: "We couldn't find a job advert here. Highlight its text, or scan the screen." }, { status: 400 });

  const db = createAdminClient();
  const res = await captureJob(db, user.id, user.targetMarkets, input);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  const { data } = await db.from("jobs").select("parsed").eq("id", res.jobId).eq("user_id", user.id).maybeSingle();
  const job = jobSchema.safeParse(data?.parsed);
  const p = job.success ? job.data : null;
  const location = p ? [p.location.city, p.location.state, p.location.country].filter(Boolean).join(", ") : "";
  return NextResponse.json({ ok: true, jobId: res.jobId, title: p?.title ?? null, employer: p?.employer_name ?? null, location: location || null });
}
