"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { getJob } from "@/lib/jobs/data";
import { generateForJob, getCvById, type GenerateResult } from "@/lib/cv/data";
import { ensureDraftApplication } from "@/lib/applications/pack";
import { getVault } from "@/lib/vault/data";
import { lockLine, type LockSource } from "@/lib/rules/fact-lock";
import { findBullet, mergeFlags, removeSkill, updateBullet } from "@/lib/cv/ops";
import type { CvDoc } from "@/lib/cv/types";
import { extractMetrics } from "@/lib/vault/metrics";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { track } from "@/lib/analytics/server";

export async function generateCv(jobId: string): Promise<GenerateResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "error", error: "Please sign in again." };
  if (!viewer.preview && !(await allow("tailor"))) return { ok: false, reason: "error", error: RATE_LIMITED_MESSAGE };
  const job = await getJob(viewer, jobId);
  const res = await generateForJob(viewer, job);
  if (res.ok) await ensureDraftApplication(viewer, job, res.cvId);
  revalidatePath(`/jobs/${jobId}/cv`);
  revalidatePath("/applications");
  return res;
}

const opSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resolve"), bulletId: z.string(), action: z.enum(["removed", "kept"]) }),
  z.object({ kind: z.literal("edit"), bulletId: z.string(), text: z.string().trim().min(5).max(360) }),
  z.object({ kind: z.literal("original"), bulletId: z.string() }),
  z.object({ kind: z.literal("vault"), bulletId: z.string() }),
  z.object({ kind: z.literal("include"), field: z.enum(["date_of_birth"]), on: z.boolean() }),
  // Suggestions take effect only when accepted (D-163).
  z.object({ kind: z.literal("accept"), bulletId: z.string() }),
  z.object({ kind: z.literal("accept_all") }),
  z.object({ kind: z.literal("summary"), choice: z.enum(["suggested", "own", "edit"]), text: z.string().trim().max(900).optional() }),
  z.object({ kind: z.literal("remove_skill"), skill: z.string().trim().min(1).max(80) }),
]);
export type CvOp = z.infer<typeof opSchema>;
export type EditResult = { ok: true; doc: CvDoc; cvId: string; newFacts: string[] } | { ok: false; error: string };

/**
 * Edits to a tailored CV. Every edit is checked by the fact lock again; a new fact the
 * vault doesn't have can be added to it ("Add this to your vault?") so it isn't flagged
 * again. A CV that was already packed is never changed: edits make a new version.
 */
export async function editCv(cvId: string, rawOp: CvOp): Promise<EditResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const op = opSchema.safeParse(rawOp);
  if (!op.success) return { ok: false, error: "That change didn't work. Try again." };
  if (viewer.preview) return { ok: false, error: "preview" };
  const cv = await getCvById(viewer, cvId);
  if (!cv) return { ok: false, error: "We couldn't find this CV." };
  const supabase = await createClient();
  const vault = await getVault(viewer);
  const sources = new Map<string, LockSource>();
  for (const r of vault.roles.filter((x) => x.confirmed))
    for (const i of r.items.filter((x) => x.confirmed))
      sources.set(i.id, { id: i.id, text: i.text, sourceQuote: i.sourceQuote, metrics: i.metrics, ownership: i.ownership, skills: i.skills, role: { kind: r.kind, organisation: r.organisation, title: r.title, location: r.location, start: r.start, end: r.end, grade: r.grade } });
  const relock = (text: string, ids: string[]) => lockLine(text, ids.map((id) => sources.get(id)).filter((s): s is LockSource => Boolean(s)));

  let doc = cv.doc;
  let newFacts: string[] = [];
  const o = op.data;
  if (o.kind === "include") {
    doc = { ...doc, include: { ...doc.include, [o.field]: o.on } };
    if (o.on) await supabase.from("consents").insert({ user_id: viewer.id, type: "sensitive_details", version: `export:${cvId}:${o.field}`, granted_at: new Date().toISOString() });
  } else if (o.kind === "remove_skill") {
    doc = removeSkill(doc, o.skill);
  } else if (o.kind === "accept_all") {
    doc = { ...doc, sections: doc.sections.map((s) => (s.kind === "roles" ? { ...s, roles: s.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => ({ ...b, pending: false })) })) } : s)) };
    await track("claim_review_completed", { confirmed: 1, edited: 0, reverted: 0 }, viewer.id);
  } else if (o.kind === "summary") {
    const own = doc.summary.own ?? "";
    if (o.choice === "own") doc = { ...doc, summary: { ...doc.summary, text: own, flags: [], confirmed: true } };
    else if (o.choice === "suggested") doc = { ...doc, summary: { ...doc.summary, confirmed: true } };
    else {
      const text = (o.text ?? "").replace(/\s*\u2014\s*/g, ", ");
      if (text.length < 20) return { ok: false, error: "Write at least a sentence for your summary." };
      // Checked against the items the summary used and the person's own summary.
      const srcs = [...doc.summary.sourceItemIds.map((id) => sources.get(id)).filter((s): s is LockSource => Boolean(s)), ...(own ? [{ id: "own:summary", text: own, sourceQuote: own, metrics: [], ownership: "did" as const, skills: [], role: { kind: "profile", organisation: null, title: null, location: null, start: null, end: null, grade: null } }] : [])];
      doc = { ...doc, summary: { ...doc.summary, text, flags: lockLine(text, srcs.length ? srcs : [...sources.values()]).map((f) => ({ ...f, status: "open" as const })), confirmed: true } };
    }
  } else {
    const found = findBullet(doc, o.bulletId);
    if (!found) return { ok: false, error: "That line is no longer on this CV." };
    const { bullet, roleId } = found;
    if (o.kind === "accept") {
      doc = updateBullet(doc, o.bulletId, (b) => ({ ...b, pending: false }));
    } else if (o.kind === "resolve") {
      for (const f of bullet.flags.filter((x) => x.status === "open")) await track("flag_resolved", { type: f.type, action: o.action }, viewer.id);
      doc = o.action === "removed" ? updateBullet(doc, o.bulletId, () => null) : updateBullet(doc, o.bulletId, (b) => ({ ...b, flags: b.flags.map((f) => ({ ...f, status: f.status === "open" ? "kept" : f.status })) }));
    } else if (o.kind === "original") {
      const flags = mergeFlags(bullet.flags, relock(bullet.original, bullet.sourceItemIds));
      doc = updateBullet(doc, o.bulletId, (b) => ({ ...b, text: b.original, rewriteType: "kept", flags, pending: false }));
      await track("claim_review_completed", { confirmed: 0, edited: 0, reverted: 1 }, viewer.id);
    } else if (o.kind === "edit") {
      const next = relock(o.text, bullet.sourceItemIds);
      const flags = mergeFlags(bullet.flags, next);
      newFacts = next.filter((f) => f.type !== "phrase" && f.type !== "ownership" && f.type !== "approximate").map((f) => f.token);
      for (const f of bullet.flags.filter((x) => x.status === "open" && !next.some((n) => n.type === x.type && n.token === x.token))) await track("flag_resolved", { type: f.type, action: "fixed" }, viewer.id);
      doc = updateBullet(doc, o.bulletId, (b) => ({ ...b, text: o.text, rewriteType: "reworded", flags, pending: false }));
      await track("claim_review_completed", { confirmed: 0, edited: 1, reverted: 0 }, viewer.id);
    } else if (o.kind === "vault") {
      // The user says the new detail is true: it joins their vault in their own words.
      const firstSource = sources.get(bullet.sourceItemIds[0] ?? "");
      const { data: item } = await supabase
        .from("vault_items")
        .insert({ user_id: viewer.id, role_id: roleId, text: bullet.text, source_quote: bullet.text, source_type: "text", metrics: extractMetrics(bullet.text), ownership: firstSource?.ownership ?? "did", skills: [], confirmed_at: new Date().toISOString() })
        .select("id")
        .single();
      if (!item) return { ok: false, error: "We couldn't add that to your experience." };
      sources.set(item.id, { id: item.id, text: bullet.text, sourceQuote: bullet.text, metrics: extractMetrics(bullet.text), ownership: firstSource?.ownership ?? "did", skills: [], role: firstSource?.role ?? { kind: "job", organisation: null, title: null, location: null, start: null, end: null, grade: null } });
      const ids = [...bullet.sourceItemIds, item.id];
      doc = updateBullet(doc, o.bulletId, (b) => ({ ...b, sourceItemIds: ids, flags: mergeFlags(b.flags, relock(b.text, ids)) }));
      revalidatePath("/experience");
    }
  }

  // A packed CV is frozen: write a new version instead.
  if (cv.locked) {
    const { data } = await supabase.from("cv_versions").insert({ user_id: viewer.id, job_id: (await supabase.from("cv_versions").select("job_id").eq("id", cvId).single()).data?.job_id, format_profile: doc.format, content: doc }).select("id").single();
    if (!data) return { ok: false, error: "We couldn't save that change." };
    return { ok: true, doc, cvId: data.id, newFacts };
  }
  const { error } = await supabase.from("cv_versions").update({ content: doc }).eq("id", cvId).eq("user_id", viewer.id);
  if (error) return { ok: false, error: "We couldn't save that change." };
  return { ok: true, doc, cvId, newFacts };
}
