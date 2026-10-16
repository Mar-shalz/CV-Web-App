import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fullCheck, type LegitimacyView } from "@/lib/legitimacy";
import { jobSchema, EMPTY_JOB } from "@/lib/jobs/schema";
import { APP } from "@/lib/config";

// Shareable job checks (D-147). The public page shows one job post's verdict and what was
// checked. Never who checked it, never the post's raw text, and contact numbers and emails
// in the findings are hidden, so a share can't spread a person's details.

export type SharedCheck = {
  slug: string;
  title: string | null;
  employer: string | null;
  location: string | null;
  sourceHost: string | null;
  state: LegitimacyView["state"];
  headline: string;
  checks: { label: string; status: "pass" | "warn" | "fail" | "unknown"; detail: string; word?: string }[];
  flags: string[];
  checkedAt: string;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const newSlug = () => [...randomBytes(10)].map((b) => ALPHABET[b % ALPHABET.length]).join("");

/** Phone numbers and emails out of public text. */
export function redact(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[number]")
    .slice(0, 600);
}

/**
 * Makes (or refreshes) the share for one job the person owns. One link per job: sharing
 * again updates it with the latest check. The check itself comes from the 7 day cache.
 */
export async function shareJobCheck(userId: string, jobId: string): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data: job } = await db.from("jobs").select("id, parsed, raw_text, post_hash, source_url").eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (!job) return { ok: false, error: "We couldn't find that job." };
  const p = jobSchema.safeParse(job.parsed);
  const parsed = p.success ? p.data : EMPTY_JOB;
  const view = await fullCheck(db, { userId, jobId: job.id, postHash: job.post_hash, text: job.raw_text ?? "", job: parsed, sourceUrl: job.source_url });
  let host: string | null = null;
  try {
    host = job.source_url ? new URL(job.source_url).hostname.replace(/^www\./, "") : null;
  } catch {}
  const row = {
    job_id: job.id,
    user_id: userId,
    title: parsed.title?.slice(0, 200) ?? null,
    employer: parsed.employer_name?.slice(0, 160) ?? null,
    location: [parsed.location.city, parsed.location.state, parsed.location.country].filter(Boolean).join(", ").slice(0, 160) || null,
    source_host: host,
    state: view.state,
    headline: redact(view.headline),
    checks: view.checks.map((c) => ({ label: c.label, status: c.status, detail: redact(c.detail), ...(c.word ? { word: c.word } : {}) })),
    flags: view.signals.filter((s) => s.id.startsWith("L1") && s.severity !== "info").map((s) => redact(s.text)),
    checked_at: view.checkedAt,
  };
  const { data: existing } = await db.from("check_shares").select("slug").eq("job_id", job.id).maybeSingle();
  if (existing) {
    const { error } = await db.from("check_shares").update(row).eq("slug", existing.slug);
    return error ? { ok: false, error: "We couldn't make the link just now." } : { ok: true, slug: existing.slug };
  }
  const slug = newSlug();
  const { error } = await db.from("check_shares").insert({ slug, ...row });
  if (error) return { ok: false, error: error.code === "42P01" || error.code === "PGRST205" ? "Sharing needs the latest database update." : "We couldn't make the link just now." };
  return { ok: true, slug };
}

export async function getSharedCheck(slug: string): Promise<SharedCheck | null> {
  if (!/^[A-Za-z0-9]{10}$/.test(slug)) return null;
  const { data } = await createAdminClient().from("check_shares").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  return {
    slug: data.slug,
    title: data.title,
    employer: data.employer,
    location: data.location,
    sourceHost: data.source_host,
    state: data.state,
    headline: data.headline ?? "",
    checks: (data.checks ?? []) as SharedCheck["checks"],
    flags: (data.flags ?? []) as string[],
    checkedAt: data.checked_at,
  };
}

/**
 * A shared check that couldn't be fully confirmed but shows no warning signs and a real
 * company (D-156), worked out from what the share kept: no flags, no failed check.
 */
export function isCalm(s: Pick<SharedCheck, "state" | "checks" | "flags">): boolean {
  return s.state === "unverified" && !s.flags.length && s.checks.every((c) => c.status !== "fail") && s.checks.some((c) => c.label === "The company exists" && c.status === "pass");
}

/** Most checks passed, nothing red, something to look at (D-173), from what the share kept. */
export function mostlyOf(s: Pick<SharedCheck, "state" | "checks">): number | null {
  if (s.state !== "unverified" || !s.checks.length || s.checks.some((c) => c.status === "fail")) return null;
  const warn = s.checks.filter((c) => c.status === "warn").length;
  const passed = s.checks.filter((c) => c.status === "pass").length;
  return warn > 0 && passed / s.checks.length >= 0.7 ? warn : null;
}

/** The words that go with the link on WhatsApp and X. */
export function shareText(s: Pick<SharedCheck, "state" | "title" | "employer"> & { calm?: boolean; mostly?: boolean }): string {
  const job = [s.title, s.employer && `at ${s.employer}`].filter(Boolean).join(" ") || "this job";
  const verdict = s.state === "red_flags" ? "showed warning signs" : s.state === "verified" ? "looks genuine on the checks" : s.calm ? "showed no warning signs" : s.mostly ? "mostly checks out" : "couldn't be confirmed";
  return `I checked ${job} with ${APP.APP_NAME} before applying: it ${verdict}. See what was checked, and check your own job free:`;
}

export const DEMO_SHARE: SharedCheck = {
  slug: "demo000000",
  title: "Graduate Trainee, Finance",
  employer: "Northbridge Bank",
  location: "Victoria Island, Lagos",
  sourceHost: "northbridgebank.ng",
  state: "verified",
  headline: "Found on the official careers page at northbridgebank.ng. Even so, never pay to apply.",
  checks: [
    { label: "The company exists", status: "pass", detail: "Official website found at northbridgebank.ng." },
    { label: "How long it has been around", status: "pass", detail: "Since 2004, about 22 years." },
    { label: "Email and apply link are on the company's own website", status: "pass", detail: "They're on northbridgebank.ng." },
    { label: "Listed under the company's name", status: "pass", detail: "Yes. It's on the company's own careers page, northbridgebank.ng." },
    { label: "No public warnings about this job", status: "pass", detail: "No warnings found from the bank or major news sites." },
  ],
  flags: [],
  checkedAt: new Date().toISOString(),
};
