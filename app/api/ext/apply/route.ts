import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extAllow, extUser } from "@/lib/ext/auth";
import { extViewer } from "@/lib/ext/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { withClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs/data";
import { generateForJob, getCvById, getLatestCv } from "@/lib/cv/data";
import { ensureDraftApplication, ensurePack, markSent } from "@/lib/applications/pack";
import { getApplicationForJob } from "@/lib/applications/data";
import { openFlags, pendingSuggestions, type CvDoc } from "@/lib/cv/types";
import { DEMO_CV } from "@/lib/demo/job";

export const maxDuration = 120;

const body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("cv"), jobId: z.string() }),
  z.object({ step: z.literal("accept"), jobId: z.string(), cvId: z.string() }),
  z.object({ step: z.literal("pack"), jobId: z.string() }),
  z.object({ step: z.literal("sent"), jobId: z.string(), applicationId: z.string() }),
]);

/** What the panel shows about a CV: how much was tailored, and what still needs a yes. */
function cvSummary(cvId: string, doc: CvDoc) {
  const bullets = doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets) : []));
  const pending = pendingSuggestions(doc);
  return {
    cvId,
    lines: bullets.length,
    tailored: bullets.filter((b) => b.rewriteType !== "kept").length,
    suggestions: pending.lines,
    summaryPending: pending.summary,
    summary: doc.summary.text || doc.summary.own || null,
    toCheck: openFlags(doc),
    file: `${doc.fileBase}.pdf`,
  };
}

/**
 * Applying from the browser extension (D-178), the short way: write the CV for the job,
 * accept its suggestions (lines the fact lock flagged stay in the person's own words),
 * prepare the email, and mark it sent. The person still sends from their own email, and
 * can open the app at any step to review and edit instead. Same entitlements as the app.
 */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Send that again." }, { status: 400 });
  const b = parsed.data;

  if (user.preview) {
    await new Promise((r) => setTimeout(r, 900));
    if (b.step === "cv") return NextResponse.json({ ok: true, cv: { cvId: "demo-cv", lines: 6, tailored: 4, suggestions: 3, summaryPending: true, summary: DEMO_CV.summary, toCheck: 1, file: "Tolu_Adebayo_CV_Graduate_Trainee_Finance.pdf" } });
    if (b.step === "accept") return NextResponse.json({ ok: true, kept: 1 });
    if (b.step === "pack")
      return NextResponse.json({
        ok: true,
        pack: { applicationId: "demo-app", channel: "email", toEmail: "graduatetrainee@northbridgebank.example", subject: "GTP2026: Tolu Adebayo, Accounting", body: "Dear Hiring Team,\n\nI'm applying for the Graduate Trainee, Finance role at Northbridge Bank...\n\nKind regards,\nTolu Adebayo", attachments: ["Tolu_Adebayo_CV_Graduate_Trainee_Finance.pdf"], checklist: [{ item: "Your CV as a PDF", required: true }], applyUrl: null, cvId: "demo-cv" },
      });
    return NextResponse.json({ ok: true });
  }

  if (!z.uuid().safeParse(b.jobId).success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (!(await extAllow(user.id, "ext_apply"))) return NextResponse.json({ ok: false, error: "You've done a lot in the last hour. Try again soon." }, { status: 429 });
  const db = createAdminClient();
  const viewer = await extViewer(db, user);
  if (viewer.suspended) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });

  try {
    return await withClient(db, async () => {
      const job = await getJob(viewer, b.jobId);

      if (b.step === "cv") {
        // An existing CV for this job is reused: no second CV from the person's allowance.
        let cv = await getLatestCv(viewer, job.id);
        if (!cv) {
          const res = await generateForJob(viewer, job);
          if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason, error: res.error }, { status: res.reason === "error" ? 500 : 402 });
          await ensureDraftApplication(viewer, job, res.cvId);
          await db.from("jobs").update({ state: "applying" }).eq("id", job.id).eq("user_id", viewer.id);
          cv = await getCvById(viewer, res.cvId);
        }
        if (!cv) return NextResponse.json({ ok: false, error: "We couldn't find your CV. Try again." }, { status: 500 });
        return NextResponse.json({ ok: true, cv: cvSummary(cv.id, cv.doc) });
      }

      if (b.step === "accept") {
        const cv = await getCvById(viewer, b.cvId);
        if (!cv) return NextResponse.json({ ok: false, error: "We couldn't find your CV." }, { status: 404 });
        // Accept the suggestions, except lines with words we couldn't trace: those stay in the person's words.
        let kept = 0;
        const doc: CvDoc = {
          ...cv.doc,
          summary: cv.doc.summary.confirmed === false ? { ...cv.doc.summary, confirmed: true, ...(cv.doc.summary.flags.some((f) => f.status === "open") ? { text: cv.doc.summary.own ?? "", flags: [] } : {}) } : cv.doc.summary,
          sections: cv.doc.sections.map((s) =>
            s.kind === "roles"
              ? {
                  ...s,
                  roles: s.roles.map((r) => ({
                    ...r,
                    bullets: r.bullets.map((x) => {
                      if (!x.pending) return x;
                      if (x.flags.some((f) => f.status === "open")) {
                        kept++;
                        return { ...x, text: x.original, rewriteType: "kept" as const, flags: [], pending: false };
                      }
                      return { ...x, pending: false };
                    }),
                  })),
                }
              : s,
          ),
        };
        if (cv.locked) return NextResponse.json({ ok: false, error: "This CV was already sent. Open the app to make a new one." }, { status: 409 });
        const { error } = await db.from("cv_versions").update({ content: doc }).eq("id", cv.id).eq("user_id", viewer.id);
        if (error) return NextResponse.json({ ok: false, error: "We couldn't save that. Try again." }, { status: 500 });
        return NextResponse.json({ ok: true, kept });
      }

      if (b.step === "pack") {
        const cv = await getLatestCv(viewer, job.id);
        if (!cv) return NextResponse.json({ ok: false, error: "Write your CV for this job first." }, { status: 409 });
        const res = await ensurePack(viewer, job, cv, null);
        if ("error" in res) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
        const app = await getApplicationForJob(viewer, job.id);
        if (!app?.pack) return NextResponse.json({ ok: false, error: "We couldn't prepare the email. Try again." }, { status: 500 });
        const p = app.pack;
        return NextResponse.json({ ok: true, pack: { applicationId: app.id, channel: p.channel, toEmail: p.toEmail, subject: p.subject, body: p.body, attachments: p.attachmentNames, checklist: p.checklist, applyUrl: p.applyUrl, cvId: cv.id } });
      }

      const res = await markSent(viewer, b.applicationId);
      if ("error" in res) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    });
  } catch {
    return NextResponse.json({ ok: false, error: "That didn't work on our side. Try again, or finish in the app." }, { status: 500 });
  }
}
