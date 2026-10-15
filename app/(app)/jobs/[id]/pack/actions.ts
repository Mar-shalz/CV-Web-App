"use server";

import { flash } from "@/lib/toast";
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

