import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { jobSchema, EMPTY_JOB, type ParsedJob } from "./schema";
import { DEMO_PARSED } from "@/lib/demo/job";
import { detectDestination, PROFILE_IDS, type Destination, type ProfileId } from "@/lib/rules/destination";

/** A column a migration hasn't added yet (PostgREST and Postgres codes). */
export const missingColumn = (e: { code?: string } | null) => Boolean(e && (e.code === "PGRST204" || e.code === "42703"));

export type JobView = {
  id: string;
  parsed: ParsedJob;
  parseStatus: "parsed" | "manual";
  sourceType: "paste" | "link" | "screenshot" | "share";
  sourceUrl: string | null;
  rawText: string | null;
  imageUrl: string | null;
  destination: Destination & { setByUser: boolean };
  capturedAt: string;
  state: string;
  reviewed: boolean;
  postHash: string;
};

/** One job the viewer owns, or a 404. In preview, "demo" is the sample job. */
export async function getJob(viewer: Viewer, id: string): Promise<JobView> {
  if (viewer.preview) {
    if (id !== "demo") notFound();
    return {
      id: "demo",
      parsed: DEMO_PARSED,
      parseStatus: "parsed",
      sourceType: "paste",
      sourceUrl: null,
      rawText: "Graduate Trainee, Finance. Northbridge Bank is recruiting... (sample)",
      imageUrl: null,
      destination: { ...detectDestination(DEMO_PARSED, viewer.targetMarkets), setByUser: false },
      capturedAt: new Date().toISOString(),
      state: "captured",
      reviewed: false,
      postHash: "demo",
    };
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const columns = "id, parsed, parse_status, source_type, source_url, raw_text, raw_image_path, destination_country, destination_confidence, destination_signals, destination_set_by_user, captured_at, state, reviewed_at, post_hash";
  // The chosen CV format (D-198) needs migration section 24; until it runs, read without it.
  const first = await supabase.from("jobs").select(`${columns}, destination_profile`).eq("id", id).eq("user_id", viewer.id).maybeSingle();
  const job = first.error && missingColumn(first.error) ? (await supabase.from("jobs").select(columns).eq("id", id).eq("user_id", viewer.id).maybeSingle()).data : first.data;
  if (!job) notFound();
  const parsed = jobSchema.safeParse(job.parsed);
  const p = parsed.success ? parsed.data : EMPTY_JOB;
  const detected = detectDestination(p, viewer.targetMarkets);
  const country = job.destination_country ?? detected.country;
  const destination = {
    ...detectDestination({ ...p, location: { ...p.location, country_code: job.destination_set_by_user ? country : p.location.country_code } }, [country, ...viewer.targetMarkets]),
    country,
    confidence: Number(job.destination_confidence ?? detected.confidence),
    signals: (job.destination_signals as string[]) ?? detected.signals,
    setByUser: Boolean(job.destination_set_by_user),
  };
  if (job.destination_set_by_user) destination.ask = false;
  const chosen = (job as { destination_profile?: string | null }).destination_profile;
  if (chosen && (PROFILE_IDS as string[]).includes(chosen)) Object.assign(destination, { profile: chosen as ProfileId, fallbackNote: null, ask: false });
  let imageUrl: string | null = null;
  if (job.raw_image_path) {
    const { data } = await supabase.storage.from("job-uploads").createSignedUrl(job.raw_image_path, 600);
    imageUrl = data?.signedUrl ?? null;
  }
  return {
    id: job.id,
    parsed: p,
    parseStatus: job.parse_status,
    sourceType: job.source_type,
    sourceUrl: job.source_url,
    rawText: job.raw_text,
    imageUrl,
    destination,
    capturedAt: job.captured_at,
    state: job.state,
    reviewed: Boolean(job.reviewed_at),
    postHash: job.post_hash,
  };
}

export type SavedJob = { id: string; title: string; employer: string; savedAt: string };

/**
 * Jobs saved for later from the job check (state "saved") that have no application yet,
 * so they show under Applications (D-122).
 */
export async function listSavedJobs(viewer: Viewer): Promise<SavedJob[]> {
  if (viewer.preview) return [{ id: "demo", title: "Graduate Trainee, Finance", employer: "Northbridge Bank", savedAt: new Date().toISOString() }];
  const supabase = await createClient();
  const [{ data: jobs }, { data: apps }] = await Promise.all([
    supabase.from("jobs").select("id, parsed, captured_at").eq("user_id", viewer.id).eq("state", "saved").order("captured_at", { ascending: false }).limit(100),
    supabase.from("applications").select("job_id").eq("user_id", viewer.id),
  ]);
  const applied = new Set((apps ?? []).map((a) => a.job_id));
  return (jobs ?? [])
    .filter((j) => !applied.has(j.id))
    .map((j) => {
      const p = jobSchema.safeParse(j.parsed);
      return { id: j.id, title: (p.success && p.data.title) || "Untitled job", employer: (p.success && p.data.employer_name) || "Employer not named", savedAt: j.captured_at };
    });
}
