"use server";

import { flash } from "@/lib/toast";
import { reportOps } from "@/lib/ops";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { markSent, ensurePack } from "@/lib/applications/pack";
import { getJob } from "@/lib/jobs/data";
import { getLatestCv } from "@/lib/cv/data";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";

export async function sentIt(applicationId: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (viewer.preview) return { ok: true };
  const res = await markSent(viewer, applicationId);
  revalidatePath("/applications");
  revalidatePath("/home");
  if (!("error" in res)) await flash("Marked as sent. We'll check in with you about it.");
  return "error" in res ? { ok: false, error: res.error } : { ok: true };
}

/** A new version of the application email for the same CV (D-170). */
export async function rewriteEmail(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (viewer.preview) return { ok: true };
  if (!(await allow("pack"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const job = await getJob(viewer, jobId);
  const cv = await getLatestCv(viewer, job.id);
  if (!cv) return { ok: false, error: "Make your CV for this job first." };
  const res = await ensurePack(viewer, job, cv, null, { fresh: true });
  if ("error" in res) return { ok: false, error: res.error };
  revalidatePath(`/jobs/${jobId}/pack`);
  return { ok: true };
}

/** The person's own edits to the cover letter's paragraphs (D-186), one blank line between each. */
export async function saveCoverLetter(packId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  if (!paragraphs.length || text.trim().length < 80) return { ok: false, error: "Write a little more before saving." };
  if (paragraphs.length > 8 || text.length > 6000) return { ok: false, error: "That's long for a cover letter. Keep it to one page, about four paragraphs." };
  if (viewer.preview) return { ok: true };
  if (!/^[0-9a-f-]{36}$/.test(packId)) return { ok: false, error: "We couldn't find this letter." };
  const supabase = await createClient();
  const { data } = await supabase.from("application_packs").select("*").eq("id", packId).eq("user_id", viewer.id).maybeSingle();
  const letter = (data as { cover_letter?: Record<string, unknown> | null } | null)?.cover_letter;
  if (!letter) return { ok: false, error: "We couldn't find this letter." };
  const { error } = await supabase.from("application_packs").update({ cover_letter: { ...letter, paragraphs } }).eq("id", packId).eq("user_id", viewer.id);
  return error ? { ok: false, error: "We couldn't save that. Try again." } : { ok: true };
}

/** The person's own edits to the application email (round 24). They're the author, so it's saved as written. */
export async function saveEmailBody(packId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const text = body.replace(/\r\n?/g, "\n").trim();
  if (text.length < 20) return { ok: false, error: "Write a little more before saving." };
  if (text.length > 5000) return { ok: false, error: "That's very long. Keep the email under 5,000 characters." };
  if (viewer.preview) return { ok: true };
  if (!/^[0-9a-f-]{36}$/.test(packId)) return { ok: false, error: "We couldn't find this email." };
  const supabase = await createClient();
  const { error } = await supabase.from("application_packs").update({ body: text }).eq("id", packId).eq("user_id", viewer.id);
  return error ? { ok: false, error: "We couldn't save that. Try again." } : { ok: true };
}

/** The extension couldn't attach the CV in Gmail: our team hears about it (D-181). */
export async function reportGmailIssue(reason: string, method: string | null): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  if (!/^[a-z_]{2,40}$/.test(reason)) return;
  await reportOps("gmail_attach_failed", { reason, method: method && /^[a-z]{2,10}$/.test(method) ? method : null, from: "app" });
}

