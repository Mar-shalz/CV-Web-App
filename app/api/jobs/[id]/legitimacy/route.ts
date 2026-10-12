import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs/data";
import { fullCheck, type LegitimacyView } from "@/lib/legitimacy";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { DEMO_SCAM } from "@/lib/demo/job";

/** Layer 2 of the scam check, called when the job check opens. Results stream into the page. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });

  if (viewer.preview) {
    await new Promise((r) => setTimeout(r, 1600));
    const view: LegitimacyView = {
      state: DEMO_SCAM.state,
      headline: DEMO_SCAM.headline,
      signals: DEMO_SCAM.signals.map((s, i) => ({ id: `L2-0${i + 1}`, severity: "ok" as const, text: s.text, evidence: null, sourceUrl: s.source ? `https://${s.source}` : null })),
      cached: false,
      checkedAt: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, view });
  }
  if (!(await allow("job_check"))) return NextResponse.json({ ok: false, error: RATE_LIMITED_MESSAGE }, { status: 429 });

  const job = await getJob(viewer, id);
  const view = await fullCheck(await createClient(), {
    userId: viewer.id,
    jobId: job.id,
    postHash: job.postHash,
    text: job.rawText ?? "",
    job: job.parsed,
  });
  return NextResponse.json({ ok: true, view });
}
