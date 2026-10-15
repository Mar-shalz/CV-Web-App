import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extAllow, extUser } from "@/lib/ext/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { getJob } from "@/lib/jobs/data";
import { getVault } from "@/lib/vault/data";
import { getExtras } from "@/lib/vault/extras";
import { getVerdict, runEligibility } from "@/lib/jobs/check";
import { matchPercent, requirementKey } from "@/lib/rules/match-score";

export const maxDuration = 90;

const LABEL = { apply: "Apply", apply_with_care: "Apply with care", skip: "Skip this one" } as const;

/**
 * How well the person matches the job they scanned (D-164): the same fit check and match
 * percentage as the app, run with the extension's key. Every query on this path filters by
 * the person's id; the service role client stands in for their session only here.
 */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const id = z.object({ jobId: z.string() }).safeParse(await request.json().catch(() => null));
  if (!id.success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (user.preview) {
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json({ ok: true, pct: 78, verdict: "apply", label: LABEL.apply, line: "Your SIWES banking work matches most of what they ask for.", met: 3, total: 4, gaps: ["ICAN membership"] });
  }
  if (!z.uuid().safeParse(id.data.jobId).success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (!(await extAllow(user.id, "ext_fit"))) return NextResponse.json({ ok: false, error: "You've checked your match a lot in the last hour. Try again soon." }, { status: 429 });

  const db = createAdminClient();
  const { data: row } = await db.from("users").select("*").eq("id", user.id).maybeSingle();
  const u = (row ?? {}) as { career_stage?: string | null; target_markets?: string[] | null; low_data_mode?: boolean };
  const viewer: Viewer = {
    id: user.id,
    email: user.email,
    fullName: user.name,
    careerStage: u.career_stage ?? null,
    targetMarkets: u.target_markets ?? user.targetMarkets,
    lowDataMode: Boolean(u.low_data_mode),
    consentDone: true,
    setupDone: true,
    trial: { startedAt: null, endsAt: null, cvsUsed: 0 },
    activePass: null,
    suspended: false,
    preview: false,
  };
  try {
    const out = await withClient(db, async () => {
      const job = await getJob(viewer, id.data.jobId);
      const [vault, extras] = await Promise.all([getVault(viewer), getExtras(viewer)]);
      if (!vault.confirmedItems) return { empty: true as const };
      const eligibility = await runEligibility(viewer, job, vault);
      const v = await getVerdict(viewer, job, vault, eligibility);
      const added = new Set(extras.addedSkills.filter((a) => a.jobId === job.id).map((a) => requirementKey(a.requirement)));
      return { empty: false as const, v, pct: matchPercent(v.requirements, job.parsed.requirements, added), added };
    });
    if (out.empty) return NextResponse.json({ ok: false, error: "Add and confirm your experience in Receipts first, so we can compare it with this job." }, { status: 422 });
    const { v, pct, added } = out;
    return NextResponse.json({
      ok: true,
      pct,
      verdict: v.verdict,
      label: LABEL[v.verdict],
      line: v.line,
      met: v.requirements.filter((r) => r.status === "met" || added.has(requirementKey(r.text))).length,
      total: v.requirements.length,
      gaps: v.requirements.filter((r) => r.status === "missing" && !added.has(requirementKey(r.text))).slice(0, 3).map((r) => r.text),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "We couldn't check your match just now. Try again." }, { status: 500 });
  }
}
