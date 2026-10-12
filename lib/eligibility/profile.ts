import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import type { Vault } from "@/lib/vault/data";
import type { HardFilter } from "@/lib/jobs/schema";
import type { EligibilityProfile } from "@/lib/rules/eligibility/types";
import { createClient } from "@/lib/supabase/server";
import { readSensitive, type SensitiveField } from "@/lib/sensitive";
import { APP } from "@/lib/config";

export const todayLagos = () => new Intl.DateTimeFormat("en-CA", { timeZone: APP.timezone }).format(new Date());

function monthsBetween(start: string | null, end: string | null, today: string): number {
  if (!start) return 0;
  const [sy, sm] = start.split("-").map(Number) as [number, number];
  const [ey, em] = (end ?? today).split("-").map(Number) as [number, number];
  return Math.max(0, (ey - sy) * 12 + (em - sm) + 1);
}

function licenceStatus(text: string): EligibilityProfile["licences"][number]["status"] {
  const t = text.toLowerCase();
  if (/in progress|ongoing|student|studying|skills level|foundation|knowledge level|pursuing/.test(t)) return "in_progress";
  if (/part[- ]?qualified|passed \d|some papers/.test(t)) return "part_qualified";
  if (/qualified|chartered|member|associate|fellow|\baca\b|\bfca\b|registered|licensed|certified/.test(t)) return "qualified";
  return "unknown";
}

/**
 * The facts the eligibility rules compare against, from confirmed vault entries and
 * the profile. Sensitive fields are decrypted only when a filter on this job needs them.
 */
export async function buildEligibilityProfile(viewer: Viewer, vault: Vault, filters: HardFilter[]): Promise<EligibilityProfile> {
  const today = todayLagos();
  const confirmed = vault.roles.filter((r) => r.confirmed);
  const types = new Set(filters.map((f) => f.type));
  const need: SensitiveField[] = [];
  if (types.has("max_age")) need.push("date_of_birth");
  if (types.has("gender")) need.push("gender");
  if (types.has("nysc") || types.has("years_experience")) need.push("nysc_status", "nysc_end");

  const nyscRole = confirmed.find((r) => r.kind === "nysc_ppa");
  let sensitive: Awaited<ReturnType<typeof readSensitive>> = {};
  let location: EligibilityProfile["location"] = null;
  let rightToWork: EligibilityProfile["rightToWork"] = {};
  let olevel: EligibilityProfile["olevel"] = null;

  if (viewer.preview) {
    sensitive = { date_of_birth: "2001-03-14", nysc_status: "completed", nysc_end: "2026-10-01" };
    location = { city: "Yaba", state: "Lagos" };
  } else {
    const supabase = await createClient();
    const [s, { data: profile }, olevelRows] = await Promise.all([
      readSensitive(viewer.id, need),
      supabase.from("profiles").select("city, state, right_to_work").eq("user_id", viewer.id).maybeSingle(),
      types.has("olevel") ? supabase.from("olevel_results").select("subjects").eq("user_id", viewer.id) : Promise.resolve({ data: null }),
    ]);
    sensitive = s;
    location = profile ? { city: profile.city, state: profile.state } : null;
    rightToWork = (profile?.right_to_work as EligibilityProfile["rightToWork"]) ?? {};
    const rows = (olevelRows.data ?? []) as { subjects: { name: string; grade: string }[] }[];
    olevel = rows.length ? { sittings: rows.map((r) => ({ subjects: r.subjects })) } : null;
  }

  const nyscStatus = (sensitive.nysc_status as EligibilityProfile["nysc"]["status"]) ?? (nyscRole ? (nyscRole.isCurrent ? "serving" : nyscRole.end ? "completed" : null) : null);
  const nyscEnd = sensitive.nysc_end ?? (nyscRole?.end ? `${nyscRole.end}-28` : null);

  const jobs = confirmed.filter((r) => r.kind === "job");
  const afterNysc = (r: (typeof jobs)[number]) => {
    if (!nyscEnd || !r.start) return monthsBetween(r.start, r.isCurrent ? null : r.end, today);
    const start = r.start > nyscEnd.slice(0, 7) ? r.start : nyscEnd.slice(0, 7);
    return monthsBetween(start, r.isCurrent ? null : r.end, today);
  };

  return {
    today,
    dateOfBirth: sensitive.date_of_birth ?? null,
    gender: sensitive.gender ?? null,
    nysc: { status: nyscStatus, end: nyscEnd },
    education: confirmed
      .filter((r) => r.kind === "education")
      .map((r) => ({ title: r.title ?? "", grade: r.grade, graduationYear: r.end ? Number(r.end.slice(0, 4)) : null })),
    months: {
      jobs: jobs.reduce((s, r) => s + monthsBetween(r.start, r.isCurrent ? null : r.end, today), 0),
      jobsAfterNysc: jobs.reduce((s, r) => s + afterNysc(r), 0),
      internships: confirmed.filter((r) => r.kind === "internship_siwes").reduce((s, r) => s + monthsBetween(r.start, r.isCurrent ? null : r.end, today), 0),
    },
    licences: confirmed
      .filter((r) => r.kind === "certification" || r.kind === "licence")
      .map((r) => ({ name: [r.title, r.organisation].filter(Boolean).join(" "), status: licenceStatus(`${r.title ?? ""} ${r.grade ?? ""}`) })),
    location,
    olevel,
    rightToWork,
  };
}
