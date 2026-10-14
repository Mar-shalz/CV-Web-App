import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import type { JobView } from "@/lib/jobs/data";
import { EMPTY_JOB } from "@/lib/jobs/schema";
import { detectDestination } from "@/lib/rules/destination";
import { getVault, type Vault } from "@/lib/vault/data";
import { rangeLabel } from "@/lib/vault/dates";
import { runTask } from "@/lib/ai";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { track } from "@/lib/analytics/server";
import { buildCv } from "./generate";
import { getContact } from "./data";
import { fileBase } from "./profiles";
import { openFlags, type CvDoc } from "./types";

export type GeneralCvResult = { ok: true; cvId: string; lines: number; toCheck: number; targetTitle: string; keywordsUsed: number } | { ok: false; error: string };

const EXPERIENCE = ["job", "internship_siwes", "nysc_ppa", "volunteer", "project"];
const lineCount = (doc: CvDoc) => doc.sections.reduce((n, s) => n + (s.kind === "roles" ? s.roles.reduce((m, r) => m + r.bullets.length, 0) : 0), 0);

function workMonths(vault: Vault): number {
  const now = new Date().toISOString().slice(0, 7);
  return vault.roles
    .filter((r) => r.confirmed && r.kind === "job" && r.start)
    .reduce((sum, r) => {
      const [sy, sm] = r.start!.split("-").map(Number) as [number, number];
      const [ey, em] = (r.isCurrent || !r.end ? now : r.end).split("-").map(Number) as [number, number];
      return sum + Math.max(0, (ey - sy) * 12 + em - sm + 1);
    }, 0);
}

/**
 * "Download my CV" (D-124, D-137): a winning general CV, written fresh by the AI every
 * time from everything confirmed. First the field is read (the standard job title, the
 * industry and the words recruiters and applicant tracking systems search for), then the
 * same writer and fact lock as a tailored CV write it for that field. If the AI can't
 * write it, we say so and offer to try again, rather than hand over an unwritten copy.
 * It doesn't use a tailored CV from the trial or the pass.
 */
export async function generalCv(viewer: Viewer): Promise<GeneralCvResult> {
  if (viewer.preview) return { ok: true, cvId: "demo-cv", lines: 9, toCheck: 0, targetTitle: "Graduate Trainee, Finance", keywordsUsed: 6 };
  const vault = await getVault(viewer);
  if (vault.confirmedItems === 0) return { ok: false, error: "Confirm a few achievements first. Your CV is written only from what you've confirmed." };
  if (!(await allow("tailor"))) return { ok: false, error: RATE_LIMITED_MESSAGE };

  // 1. The field: standard title, industry, level and its keywords.
  const roles = vault.roles.filter((r) => r.confirmed);
  const months = workMonths(vault);
  const target = await runTask(
    "cv_target",
    {
      roles: roles.filter((r) => EXPERIENCE.includes(r.kind)).map((r) => [r.title, r.organisation, rangeLabel(r.start, r.end, r.isCurrent)].filter(Boolean).join(", ")).slice(0, 30),
      achievements: roles.flatMap((r) => r.items.filter((i) => i.confirmed).map((i) => i.text)).slice(0, 60),
      education: roles.filter((r) => r.kind === "education").map((r) => [r.title, r.organisation, r.grade].filter(Boolean).join(", ")).slice(0, 8),
      certifications: roles.filter((r) => r.kind === "certification" || r.kind === "licence").map((r) => [r.title, r.organisation].filter(Boolean).join(", ")).slice(0, 10),
      experience_months: months,
    },
    { userId: viewer.id },
  );
  if (!target.ok) return { ok: false, error: "We couldn't write your CV just now. Try again in a minute." };
  const t = target.data;

  // 2. The CV, written for that field with the same truth rules as a tailored one.
  const parsed = { ...EMPTY_JOB, title: t.target_title, employer_name: `${t.industry} employers`, requirements: t.keywords.slice(0, 20).map((k) => ({ text: k, importance: "must" as const })) };
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
  const { doc, generated } = await buildCv(viewer, job, vault, contact, {
    extraRules: [
      `This is a general CV for ${t.target_title} roles in ${t.industry} at ${t.level} level, not one advert. The "requirements" are the field's standard keywords: use the ones the evidence supports, in natural sentences, in the bullets, summary and skills.`,
      `Write the title line and summary for that field and level. The strongest honest story: ${t.angle}`,
      "Make every bullet the strongest true version: a strong verb, what was done, then the scale or result. Keep every number and fact exactly as given.",
    ],
  });
  if (!generated) return { ok: false, error: "We couldn't write your CV just now. Try again in a minute." };
  const general: CvDoc = { ...doc, fileBase: fileBase(contact.fullName, t.target_title), jobTitle: t.target_title };

  const supabase = await createClient();
  const { data, error } = await supabase.from("cv_versions").insert({ user_id: viewer.id, job_id: null, format_profile: general.format, content: general }).select("id").single();
  if (error || !data) return { ok: false, error: "We couldn't save your CV. Try again." };
  await track("cv_generated", { format: general.format, bullets_changed: 0 }, viewer.id);
  const text = JSON.stringify(general).toLowerCase();
  return { ok: true, cvId: data.id, lines: lineCount(general), toCheck: openFlags(general), targetTitle: t.target_title, keywordsUsed: t.keywords.filter((k) => text.includes(k.toLowerCase())).length };
}
