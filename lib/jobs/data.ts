import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { jobSchema, EMPTY_JOB, type ParsedJob } from "./schema";
import { DEMO_PARSED } from "@/lib/demo/job";
import { detectDestination, type Destination } from "@/lib/rules/destination";

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
  const { data: job } = await supabase
    .from("jobs")
    .select("id, parsed, parse_status, source_type, source_url, raw_text, raw_image_path, destination_country, destination_confidence, destination_signals, destination_set_by_user, captured_at, state, reviewed_at, post_hash")
    .eq("id", id)
    .eq("user_id", viewer.id)
    .maybeSingle();
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
