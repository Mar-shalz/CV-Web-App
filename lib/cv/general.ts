import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import type { JobView } from "@/lib/jobs/data";
import { EMPTY_JOB } from "@/lib/jobs/schema";
import { detectDestination } from "@/lib/rules/destination";
import { getVault, type Vault } from "@/lib/vault/data";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { track } from "@/lib/analytics/server";
import { buildCv } from "./generate";
import { getContact } from "./data";
import { fileBase } from "./profiles";
import { openFlags, type CvDoc } from "./types";

export type GeneralCvResult = { ok: true; cvId: string; lines: number; toCheck: number; reused: boolean } | { ok: false; error: string };

/** Changes when anything a CV is built from changes: confirmed roles and achievements, and their order. */
function fingerprint(vault: Vault): string {
  const facts = vault.roles
    .filter((r) => r.confirmed)
    .map((r) => [r.id, r.kind, r.title, r.organisation, r.location, r.start, r.end, r.isCurrent, r.grade, r.employmentType, r.items.filter((i) => i.confirmed).map((i) => [i.id, i.text, i.ownership])]);
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 32);
}

const lineCount = (doc: CvDoc) => doc.sections.reduce((n, s) => n + (s.kind === "roles" ? s.roles.reduce((m, r) => m + r.bullets.length, 0) : 0), 0);

/**
 * A strong general CV from My Experience, for people who want one to hand out or upload
 * anywhere (D-124). Same writer and fact lock as a tailored CV, aimed at the person's own
 * field instead of one advert. It doesn't use a tailored CV from the trial or pass, and
 * it's made again only when their experience changes.
 */
export async function generalCv(viewer: Viewer): Promise<GeneralCvResult> {
  if (viewer.preview) return { ok: true, cvId: "demo-cv", lines: 9, toCheck: 0, reused: false };
  const vault = await getVault(viewer);
  if (vault.confirmedItems === 0) return { ok: false, error: "Confirm a few achievements first. Your CV is written only from what you've confirmed." };
  const hash = fingerprint(vault);
  const supabase = await createClient();

  // Nothing changed since the last one: the same CV, no new writing.
  const { data: last } = await supabase.from("cv_versions").select("id, content").eq("user_id", viewer.id).is("job_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const lastDoc = last?.content as (CvDoc & { vaultHash?: string }) | undefined;
  if (last && lastDoc?.vaultHash === hash) return { ok: true, cvId: last.id, lines: lineCount(lastDoc), toCheck: openFlags(lastDoc), reused: true };
  if (!(await allow("tailor"))) return { ok: false, error: RATE_LIMITED_MESSAGE };

  // Aimed at their own field: the most recent job title, else their course.
  const recent = vault.roles.filter((r) => r.confirmed && r.title && ["job", "internship_siwes", "nysc_ppa"].includes(r.kind))[0] ?? vault.roles.find((r) => r.confirmed && r.kind === "education");
  const field = recent?.title ?? "their field";
  const parsed = { ...EMPTY_JOB, title: field, employer_name: "employers in their field", requirements: [] };
  const job: JobView = {
    id: "general",
    parsed,
    parseStatus: "parsed",
    sourceType: "paste",
    sourceUrl: null,
    rawText: null,
    imageUrl: null,
    destination: { ...detectDestination(parsed, viewer.targetMarkets), setByUser: false },
    capturedAt: new Date().toISOString(),
    state: "captured",
    reviewed: true,
    postHash: "general",
  };
  const contact = await getContact(viewer);
  const { doc } = await buildCv(viewer, job, vault, contact);
  const general: CvDoc & { vaultHash: string } = { ...doc, fileBase: fileBase(contact.fullName, ""), jobTitle: "", vaultHash: hash };

  const { data, error } = await supabase.from("cv_versions").insert({ user_id: viewer.id, job_id: null, format_profile: general.format, content: general }).select("id").single();
  if (error || !data) return { ok: false, error: "We couldn't save your CV. Try again." };
  await track("cv_generated", { format: general.format, bullets_changed: 0 }, viewer.id);
  return { ok: true, cvId: data.id, lines: lineCount(general), toCheck: openFlags(general), reused: false };
}
