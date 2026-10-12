import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { runTask } from "@/lib/ai";
import { track } from "@/lib/analytics/server";
import { LEGAL } from "@/lib/config";

export type DebriefQuestion = { text: string; topic: string };
export type DebriefView = { id: string; questions: DebriefQuestion[]; format: string | null; panel: string | null; shareConsent: boolean; createdAt: string };

export async function hasDebrief(viewer: Viewer, applicationId: string): Promise<boolean> {
  if (viewer.preview) return false;
  const supabase = await createClient();
  const { count } = await supabase.from("debriefs").select("id", { count: "exact", head: true }).eq("application_id", applicationId).eq("user_id", viewer.id);
  return (count ?? 0) > 0;
}

export async function getDebrief(viewer: Viewer, applicationId: string): Promise<DebriefView | null> {
  if (viewer.preview) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("debriefs").select("id, questions, format, panel, share_consent, created_at").eq("application_id", applicationId).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { id: data.id, questions: (data.questions ?? []) as DebriefQuestion[], format: data.format, panel: data.panel, shareConsent: data.share_consent, createdAt: data.created_at } : null;
}

/**
 * Voice or text debrief (screen 20). The transcript is the person's own words and stays
 * on their record; the questions go into the shared question bank only with consent,
 * without names or the employer's contact details.
 */
export async function saveDebrief(viewer: Viewer, applicationId: string, role: string, transcript: string, mode: "voice" | "text", share: boolean): Promise<{ ok: true; debrief: DebriefView } | { error: string }> {
  const res = viewer.preview ? null : await runTask("extract_debrief", { transcript, role }, { userId: viewer.id });
  const questions = res?.ok ? res.data.questions : viewer.preview ? [{ text: "Tell us about yourself.", topic: "about_you" }, { text: "Walk us through the audit work on your CV.", topic: "cv" }] : [];
  const format = res?.ok ? res.data.format : "unknown";
  const panel = res?.ok ? res.data.panel : null;
  if (viewer.preview) return { ok: true, debrief: { id: "demo-debrief", questions, format, panel, shareConsent: share, createdAt: new Date().toISOString() } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debriefs")
    .insert({ application_id: applicationId, user_id: viewer.id, transcript: transcript.slice(0, 8000), questions, format, panel, share_consent: share, mode })
    .select("id, created_at")
    .single();
  if (error || !data) return { error: "We couldn't save your debrief. Try again." };
  if (share) await supabase.from("consents").insert({ user_id: viewer.id, type: "question_bank", version: LEGAL.consents.question_bank?.version ?? "question-bank-v0.1", granted_at: new Date().toISOString() });
  await track("debrief_submitted", { mode }, viewer.id);
  return { ok: true, debrief: { id: data.id, questions, format, panel, shareConsent: share, createdAt: data.created_at } };
}
