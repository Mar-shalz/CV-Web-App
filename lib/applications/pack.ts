import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import type { JobView } from "@/lib/jobs/data";
import type { CvRecord } from "@/lib/cv/data";
import { getContact } from "@/lib/cv/data";
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

function templateBody(name: string, role: string, phone: string | null, proof: string[]): string {
  const lines = [`Dear Hiring Team,`, ``, `I am applying for the ${role} role.${proof[0] ? ` ${proof[0]}` : ""}`, ``, `My CV is attached. Thank you for considering my application.`, ``, `Yours faithfully,`, name];
  if (phone) lines.push(phone);
  return lines.join("\n");
}

/**
 * The application pack for the job's channel (Build pack screen 16). The subject line
 * is filled by code from the post's own format, so it is exactly what they asked for.
 */
export async function ensurePack(viewer: Viewer, job: JobView, cv: CvRecord, gapNote: string | null): Promise<{ applicationId: string } | { error: string }> {
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
  if (app.pack_id && app.cv_version_id === cv.id) return { applicationId: app.id };

  const contact = await getContact(viewer);
  const name = contact.fullName ?? viewer.fullName ?? "Applicant";
  const role = job.parsed.title ?? "the role";
  const phone = formatPhone(contact.phone);
  const course = cv.doc.sections.find((s) => s.key === "education" && s.kind === "lines");
  const courseTitle = course && course.kind === "lines" ? course.lines[0]?.split(" · ")[0]?.replace(/^(BSc|BA|BEng|HND|B\.Sc|MSc)\s+/i, "") ?? null : null;
  const proof = [
    cv.doc.summary.text,
    ...cv.doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets.filter((b) => !b.flags.some((f) => f.status === "open")).map((b) => b.text)) : [])),
  ]
    .filter(Boolean)
    .slice(0, 4);
  const subject = fillSubject(job.parsed.how_to_apply.subject_format, { fullName: name, role, course: courseTitle });
  const channel = job.parsed.how_to_apply.channel === "form" ? "form" : job.parsed.how_to_apply.channel === "portal" ? "portal" : "email";
  const cvFile = `${cv.doc.fileBase}.pdf`;

  const res = await runTask(
    "build_pack",
    {
      person: { full_name: name, course: courseTitle, phone },
      job: { title: role, employer: job.parsed.employer_name ?? "the employer", channel, email: job.parsed.how_to_apply.email, subject_format: job.parsed.how_to_apply.subject_format, url: job.parsed.how_to_apply.url, required_documents: job.parsed.how_to_apply.required_documents },
      proof,
      gap_note: gapNote,
      cv_file: cvFile,
    },
    { userId: viewer.id },
  );

  let body = res.ok ? res.data.body.replace(/—/g, ",") : templateBody(name, role, phone, proof);
  if (lintCopy(body).length || words(body) > 130) body = templateBody(name, role, phone, proof);
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
