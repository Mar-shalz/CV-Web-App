"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { getApplication } from "@/lib/applications/data";
import { saveDebrief, type DebriefView } from "@/lib/applications/debrief";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";

export async function submitDebrief(applicationId: string, input: { text: string; mode: "voice" | "text"; share: boolean }): Promise<{ ok: true; debrief: DebriefView } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const text = input.text.trim();
  if (text.length < 20) return { ok: false, error: "Tell us a little more: which questions they asked, and how it ran." };
  if (text.length > 8000) return { ok: false, error: "That's longer than we can read at once. Keep it to the main points." };
  if (!(await allow("debrief"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const app = await getApplication(viewer, applicationId);
  if (!app) return { ok: false, error: "We couldn't find this application." };
  const res = await saveDebrief(viewer, app.id, app.title, text, input.mode === "voice" ? "voice" : "text", Boolean(input.share));
  if ("error" in res) return { ok: false, error: res.error };
  revalidatePath(`/applications/${app.id}`);
  return { ok: true, debrief: res.debrief };
}
