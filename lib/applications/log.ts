import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "@/lib/auth/viewer";
import { captureJob } from "@/lib/jobs/capture";
import { EMPTY_JOB, type ParsedJob } from "@/lib/jobs/schema";
import { nextCheckIn, scheduleKind } from "./schedule";
import { matchAgency } from "@/lib/rules/scam/layer1";
import { track } from "@/lib/analytics/server";
import { createHash } from "node:crypto";

export type LogInput = {
  title: string;
  employer: string;
  post: string | null;
  link: string | null;
  sentOn: string; // YYYY-MM-DD
  channel: "email" | "form" | "portal" | "other";
  cv: { bytes: Buffer; name: string; type: string } | null;
};

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * An application someone already sent, with a CV made somewhere else. We keep the job
 * post and the exact file they sent, so check ins, the record and interview prep work
 * the same as for a CV tailored here.
 */
export async function logExternalApplication(supabase: SupabaseClient, viewer: Viewer, input: LogInput): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }> {
  // 1. The job: read the post when we have one, otherwise keep the title and employer.
  let jobId: string | null = null;
  if (input.post && input.post.length >= 80) {
    const res = await captureJob(supabase, viewer.id, viewer.targetMarkets, { mode: "paste", text: input.post });
    if (res.ok) jobId = res.jobId;
  } else if (input.link) {
    // The same link reading as tailoring, Google fallback included.
    const res = await captureJob(supabase, viewer.id, viewer.targetMarkets, { mode: "link", url: input.link });
    if (res.ok) jobId = res.jobId;
    else if (!input.title || !input.employer) return { ok: false, error: `${res.error} Or type the job title and employer.` };
  }
  let parsed: ParsedJob;
  if (jobId) {
    const { data } = await supabase.from("jobs").select("parsed").eq("id", jobId).eq("user_id", viewer.id).single();
    parsed = { ...EMPTY_JOB, ...((data?.parsed as ParsedJob) ?? {}) };
    // What they typed wins: it's what they applied for.
    parsed = { ...parsed, title: input.title || parsed.title, employer_name: input.employer || parsed.employer_name };
    if (!parsed.title || !parsed.employer_name) return { ok: false, error: "We couldn't find the job title or employer in the post. Type them in, then save." };
    await supabase.from("jobs").update({ parsed, state: "applied" }).eq("id", jobId).eq("user_id", viewer.id);
  } else {
    if (!input.title || !input.employer) return { ok: false, error: "We couldn't read the job title and employer from the post. Type them in, then save." };
    parsed = { ...EMPTY_JOB, is_job_post: true, title: input.title, employer_name: input.employer };
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        user_id: viewer.id,
        source_type: input.link ? "link" : "paste",
        raw_text: input.post,
        source_url: input.link,
        post_hash: createHash("sha256").update(`${input.title}|${input.employer}|${viewer.id}|${Date.now()}`).digest("hex"),
        parsed,
        parse_status: "manual",
        state: "applied",
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "We couldn't save this job. Try again." };
    jobId = data.id;
  }

  // 2. The CV they sent, kept privately in their own folder.
  let cvPath: string | null = null;
  if (input.cv) {
    const ext = input.cv.type === "application/pdf" ? "pdf" : input.cv.type === DOCX ? "docx" : null;
    if (!ext) return { ok: false, error: "Use the CV as a PDF or a Word file (.docx)." };
    cvPath = `${viewer.id}/sent/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("cv-exports").upload(cvPath, input.cv.bytes, { contentType: input.cv.type, upsert: false });
    if (error) return { ok: false, error: "We couldn't save your CV file. Try again." };
  }

  // 3. The application, as sent on the day they say.
  const sentAt = new Date(`${input.sentOn}T12:00:00+01:00`);
  const kind = scheduleKind(parsed.experience_level ?? "unknown", Boolean(matchAgency(parsed.employer_name)));
  const next = nextCheckIn(kind, sentAt, parsed.deadline ?? null, 0);
  const { data: app, error } = await supabase
    .from("applications")
    .insert({
      user_id: viewer.id,
      job_id: jobId,
      status: "sent",
      sent_at: sentAt.toISOString(),
      job_snapshot: { parsed, rawText: input.post, sourceUrl: input.link, imagePath: null, capturedAt: new Date().toISOString() },
      next_check_in_at: next && next.getTime() > Date.now() ? next.toISOString() : new Date(Date.now() + 86_400_000).toISOString(),
      schedule_kind: kind,
      source: "logged",
      external_cv_path: cvPath,
      external_cv_name: input.cv?.name.slice(0, 120) ?? null,
    })
    .select("id")
    .single();
  if (error || !app) return { ok: false, error: "We couldn't save this application. Run the latest database file, then try again." };
  await supabase.from("outcome_events").insert({ application_id: app.id, user_id: viewer.id, from_status: null, to_status: "sent", source: "tap" });
  await track("application_sent", { channel: input.channel }, viewer.id);
  return { ok: true, applicationId: app.id };
}
