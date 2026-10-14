"use server";

import { flash } from "@/lib/toast";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { markSent } from "@/lib/applications/pack";

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
