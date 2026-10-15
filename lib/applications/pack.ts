import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import type { JobView } from "@/lib/jobs/data";
import type { CvRecord } from "@/lib/cv/data";
import { getContact } from "@/lib/cv/data";
import { finalDoc } from "@/lib/cv/types";
import { formatPhone } from "@/lib/cv/generate";
import { runTask } from "@/lib/ai";
import { fillSubject } from "@/lib/pack/subject";
import { lintCopy } from "@/lib/copy-lint";
import { matchAgency } from "@/lib/rules/scam/layer1";
import { canTransition } from "@/lib/rules/status-flow";
import { nextCheckIn, scheduleKind } from "./schedule";
import { getApplication } from "./data";
import { track } from "@/lib/analytics/server";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** When the model is unavailable: short, specific, and still worth reading (D-170). */
function templateBody(name: string, role: string, employer: string | null, phone: string | null, email: string | null, proof: string[]): string {
  const [first, second] = proof.slice(1).length ? proof.slice(1) : proof;
  const lines = [
    `Dear Hiring Team,`,
    ``,
    `I'm applying for the ${role} role${employer ? ` at ${employer}` : ""}.${proof[0] ? ` ${proof[0]}` : ""}`,
    ...(first ? [``, `${first}${second && second !== first ? ` ${second}` : ""}`] : []),
    ``,
    `My CV is attached. I'd welcome the chance to talk about how I can help your team.`,
    ``,
    `Kind regards,`,
    name,
  ];
  if (phone) lines.push(phone);
  if (email) lines.push(email);
  return lines.join("\n");
}

/**
 * The application pack for the job's channel (Build pack screen 16). The subject line
 * is filled by code from the post's own format, so it is exactly what they asked for.
 */
export async function ensurePack(viewer: Viewer, job: JobView, cv: CvRecord, gapNote: string | null, opts: { fresh?: boolean } = {}): Promise<{ applicationId: string } | { error: string }> {
  const supabase = await createClient();
  // Already sent: show that application, never start a second one for the same job.
  const { data: sent } = await supabase.from("applications").select("id").eq("job_id", job.id).eq("user_id", viewer.id).not("sent_at", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (sent) return { applicationId: sent.id };
  let { data: app } = await supabase.from("applications").select("id, status, pack_id, cv_version_id").eq("job_id", job.id).eq("user_id", viewer.id).in("status", ["draft", "packed"]).maybeSingle();
  if (!app) {
    const { data, error } = await supabase.from("applications").insert({ user_id: viewer.id, job_id: job.id, cv_version_id: cv.id, status: "draft" }).select("id, status, pack_id, cv_version_id").single();
    if (error || !data) return { error: "We couldn't start this application. Try again." };
    app = data;
  }
  // "Write it again" (D-170) makes a new email for the same CV.
  if (app.pack_id && app.cv_version_id === cv.id && !opts.fresh) return { applicationId: app.id };

  const contact = await getContact(viewer);
  const name = contact.fullName ?? viewer.fullName ?? "Applicant";
  const role = job.parsed.title ?? "the role";
  const phone = formatPhone(contact.phone);
  const course = cv.doc.sections.find((s) => s.key === "education");
  const firstQualification = course?.kind === "entries" ? course.entries[0]?.title : course?.kind === "lines" ? course.lines[0]?.split(" · ")[0] : undefined;
  const courseTitle = firstQualification?.replace(/^(BSc|BA|BEng|HND|B\.Sc\.?|MSc|B\.A\.?)\s+/i, "").replace(/\s*\(.*\)$/, "") ?? null;
  // The email draws on what the CV file says: accepted suggestions only (D-163).
  const sentDoc = finalDoc(cv.doc);
  const proof = [
    sentDoc.summary.text,
    ...sentDoc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets.filter((b) => !b.flags.some((f) => f.status === "open")).map((b) => b.text)) : [])),
  ]
    .filter(Boolean)
    .slice(0, 6);
  const subject = fillSubject(job.parsed.how_to_apply.subject_format, { fullName: name, role, course: courseTitle });
  const channel = job.parsed.how_to_apply.channel === "form" ? "form" : job.parsed.how_to_apply.channel === "portal" ? "portal" : "email";
  const cvFile = `${cv.doc.fileBase}.pdf`;

  const res = await runTask(
    "build_pack",
    {
      person: { full_name: name, course: courseTitle, phone, email: contact.email, title_line: cv.doc.titleLine || null },
      requirements: job.parsed.requirements.filter((r) => r.importance === "must").map((r) => r.text).slice(0, 4),
      spelling: cv.doc.format === "us" ? "American English" : "British English",
      job: { title: role, employer: job.parsed.employer_name ?? "the employer", channel, email: job.parsed.how_to_apply.email, subject_format: job.parsed.how_to_apply.subject_format, url: job.parsed.how_to_apply.url, required_documents: job.parsed.how_to_apply.required_documents },
      proof,
      gap_note: gapNote,
      cv_file: cvFile,
    },
    { userId: viewer.id },
  );

  const employer = job.parsed.employer_name ?? null;
  let body = res.ok ? res.data.body.replace(/\s*\u2014\s*/g, ", ") : templateBody(name, role, employer, phone, contact.email, proof);
  if (lintCopy(body).length || words(body) > 190) body = templateBody(name, role, employer, phone, contact.email, proof);
  const checklist = res.ok && res.data.checklist.length ? res.data.checklist : [{ item: "Your CV as a PDF", required: true }, ...job.parsed.how_to_apply.required_documents.filter((d) => !/^cv$|resume|curriculum/i.test(d)).map((d) => ({ item: d, required: true }))];
  if (job.parsed.how_to_apply.subject_format) checklist.unshift({ item: "Use the exact subject line above", required: true });
  const attachments = res.ok && res.data.attachment_names.length ? [cvFile, ...res.data.attachment_names.filter((a) => a !== cvFile)] : [cvFile];

  const { data: pack, error } = await supabase
    .from("application_packs")
    .insert({
      user_id: viewer.id,
      cv_version_id: cv.id,
      channel,
      to_email: job.parsed.how_to_apply.email,
      subject,
      body,
      attachment_names: attachments.slice(0, 8),
      form_fields: res.ok ? res.data.form_fields : [],
      checklist: checklist.slice(0, 10),
      portal_steps: res.ok ? res.data.portal_steps : [],
      apply_url: job.parsed.how_to_apply.url,
    })
    .select("id")
    .single();
  if (error || !pack) return { error: "We couldn't prepare your application. Try again." };

  await supabase.from("applications").update({ pack_id: pack.id, cv_version_id: cv.id, status: "packed" }).eq("id", app.id).eq("user_id", viewer.id);
  if (app.status === "draft") await supabase.from("outcome_events").insert({ application_id: app.id, user_id: viewer.id, from_status: "draft", to_status: "packed", source: "tap" });
  await track("pack_opened", { channel }, viewer.id);
  return { applicationId: app.id };
}

/**
 * "I've sent it": the job snapshot is frozen, the CV version is locked (edits make a new
 * version), and the first check in is scheduled. We never send anything ourselves.
 */
export async function markSent(viewer: Viewer, applicationId: string): Promise<{ ok: true } | { error: string }> {
  const app = await getApplication(viewer, applicationId);
  if (!app) return { error: "We couldn't find this application." };
  if (!canTransition(app.status, "sent")) return app.status === "sent" ? { ok: true } : { error: "This application can't be marked as sent." };
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("parsed, raw_text, source_url, raw_image_path, captured_at").eq("id", app.jobId).eq("user_id", viewer.id).maybeSingle();
  if (!job) return { error: "We couldn't find the job for this application." };
  const now = new Date();
  const kind = scheduleKind(job.parsed?.experience_level ?? "unknown", Boolean(matchAgency(job.parsed?.employer_name)));
  const next = nextCheckIn(kind, now, job.parsed?.deadline ?? null, 0);

  const { error } = await supabase
    .from("applications")
    .update({
      status: "sent",
      sent_at: now.toISOString(),
      job_snapshot: { parsed: job.parsed, rawText: job.raw_text, sourceUrl: job.source_url, imagePath: job.raw_image_path, capturedAt: job.captured_at },
      next_check_in_at: next?.toISOString() ?? null,
      schedule_kind: kind,
    })
    .eq("id", applicationId)
    .eq("user_id", viewer.id);
  if (error) return { error: "We couldn't save that. Try again." };
  if (app.cvId) await supabase.from("cv_versions").update({ locked_at: now.toISOString() }).eq("id", app.cvId).eq("user_id", viewer.id).is("locked_at", null);
  await supabase.from("outcome_events").insert({ application_id: applicationId, user_id: viewer.id, from_status: "packed", to_status: "sent", source: "tap" });
  await supabase.from("jobs").update({ state: "applied" }).eq("id", app.jobId).eq("user_id", viewer.id);
  await track("application_sent", { channel: app.pack?.channel ?? "email" }, viewer.id);
  return { ok: true };
}

/**
 * A tailored CV makes the job an application straight away (D-105): it shows under
 * Applications as "Not sent yet" with its CV, before the pack is built. One per job.
 */
export async function ensureDraftApplication(viewer: Viewer, job: JobView, cvId: string): Promise<void> {
  if (viewer.preview) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("applications").select("id, status").eq("job_id", job.id).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) {
    // A newer CV for a job not yet packed or sent becomes the one on the application.
    if (existing.status === "draft") await supabase.from("applications").update({ cv_version_id: cvId }).eq("id", existing.id).eq("user_id", viewer.id);
    return;
  }
  await supabase.from("applications").insert({
    user_id: viewer.id,
    job_id: job.id,
    cv_version_id: cvId,
    status: "draft",
    job_snapshot: { parsed: job.parsed, rawText: job.rawText, sourceUrl: job.sourceUrl, imagePath: null, capturedAt: job.capturedAt },
  });
}
