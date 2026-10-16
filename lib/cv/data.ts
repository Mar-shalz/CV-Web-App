import "server-only";
import { getExtras } from "@/lib/vault/extras";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/auth/viewer";
import type { JobView } from "@/lib/jobs/data";
import { getVault } from "@/lib/vault/data";
import { accessState } from "@/lib/entitlements";
import { track } from "@/lib/analytics/server";
import { buildCv, type ContactDetails } from "./generate";
import { demoCvDoc } from "@/lib/demo/cv-doc";
import type { CvDoc } from "./types";
import { startTrialIfNeeded } from "@/lib/entitlements-server";
import { passCvUsage } from "@/lib/payments/pass-usage";
import { PRICES } from "@/lib/config";
import { formatNaira } from "@/lib/format";

export type CvRecord = { id: string; doc: CvDoc; locked: boolean; createdAt: string };

export async function getLatestCv(viewer: Viewer, jobId: string): Promise<CvRecord | null> {
  if (viewer.preview) return jobId === "demo" ? { id: "demo-cv", doc: demoCvDoc(), locked: false, createdAt: new Date().toISOString() } : null;
  const supabase = await createClient();
  const { data } = await supabase.from("cv_versions").select("id, content, locked_at, created_at").eq("job_id", jobId).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { id: data.id, doc: data.content as CvDoc, locked: Boolean(data.locked_at), createdAt: data.created_at } : null;
}

export async function getCvById(viewer: Viewer, cvId: string): Promise<CvRecord | null> {
  if (viewer.preview) return cvId === "demo-cv" ? { id: "demo-cv", doc: demoCvDoc(), locked: false, createdAt: new Date().toISOString() } : null;
  if (!/^[0-9a-f-]{36}$/.test(cvId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("cv_versions").select("id, content, locked_at, created_at").eq("id", cvId).eq("user_id", viewer.id).maybeSingle();
  return data ? { id: data.id, doc: data.content as CvDoc, locked: Boolean(data.locked_at), createdAt: data.created_at } : null;
}

export const getContact = cache(async (viewer: Viewer): Promise<ContactDetails> => {
  if (viewer.preview) return { fullName: "Tolu Adebayo", phone: "+234 8030000000", email: "tolu.adebayo@gmail.com", city: "Yaba", state: "Lagos", linkedin: null, portfolio: null, website: null };
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("user_id", viewer.id).maybeSingle();
  // select("*") so the page keeps working before the links migration runs.
  const row = (data ?? {}) as Record<string, string | null>;
  return { fullName: row.full_name ?? viewer.fullName, phone: row.phone ?? null, email: row.contact_email ?? viewer.email, city: row.city ?? null, state: row.state ?? null, linkedin: row.linkedin_url ?? null, portfolio: row.portfolio_url ?? null, website: row.website_url ?? null };
});

export type GenerateResult = { ok: true; cvId: string } | { ok: false; reason: "paywall" | "cv_cap" | "error" | "no_items"; error: string };

/** Writes a new tailored CV version for a job, within the trial cap or the pass. */
export async function generateForJob(viewer: Viewer, job: JobView): Promise<GenerateResult> {
  if (viewer.preview) return { ok: true, cvId: "demo-cv" };
  const access = accessState({ trialStartedAt: viewer.trial.startedAt, trialEndsAt: viewer.trial.endsAt, trialCvsUsed: viewer.trial.cvsUsed, activePass: viewer.activePass });
  if (access.kind === "trial_ended") {
    await track("paywall_shown", { trigger: access.reason === "cv_cap" ? "trial_cv_cap" : "trial_ended" }, viewer.id);
    return { ok: false, reason: "paywall", error: "Your trial has ended." };
  }
  if (access.kind === "trial_ready") await startTrialIfNeeded(viewer);
  // The pass includes a set number of tailored CVs; top-ups add more (D-114).
  if (access.kind === "pass") {
    const usage = await passCvUsage(viewer);
    if (usage && usage.left <= 0) {
      await track("paywall_shown", { trigger: "pass_cv_cap" }, viewer.id);
      return { ok: false, reason: "cv_cap", error: `You've made all ${usage.cap} tailored CVs in this pass. Add ${PRICES.products.cv_topup.adds_cvs} more for ${formatNaira(PRICES.products.cv_topup.amount_kobo)}.` };
    }
  }

  const vault = await getVault(viewer);
  if (vault.confirmedItems === 0) return { ok: false, reason: "no_items", error: "Confirm a few achievements in My experience first. Your CV is written only from them." };
  const [contact, extras] = await Promise.all([getContact(viewer), getExtras(viewer)]);
  const { doc, generated, violations } = await buildCv(viewer, job, vault, contact, { extras });

  const supabase = await createClient();
  const { data, error } = await supabase.from("cv_versions").insert({ user_id: viewer.id, job_id: job.id, format_profile: doc.format, content: doc }).select("id").single();
  if (error || !data) return { ok: false, reason: "error", error: "We couldn't save your CV. Try again." };

  if (access.kind !== "pass") {
    const admin = createAdminClient();
    const { data: usage } = await admin.from("usage_counters").select("trial_cvs_used").eq("user_id", viewer.id).maybeSingle();
    await admin.from("usage_counters").update({ trial_cvs_used: (usage?.trial_cvs_used ?? 0) + 1 }).eq("user_id", viewer.id);
  }
  const bullets = doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets) : []));
  await track("cv_generated", { format: doc.format, bullets_changed: bullets.filter((b) => b.rewriteType !== "kept").length }, viewer.id);
  for (const v of violations) await track("fact_lock_violation", { type: v.split(":")[1]?.trim().split(" ")[0] ?? "unknown", prompt_version: "tailor_cv/v3" }, viewer.id);
  for (const f of bullets.flatMap((b) => b.flags)) await track("flag_shown", { type: f.type }, viewer.id);
  void generated;
  return { ok: true, cvId: data.id };
}
