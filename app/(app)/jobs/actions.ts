"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { jobSchema } from "@/lib/jobs/schema";
import { detectDestination } from "@/lib/rules/destination";
import { track } from "@/lib/analytics/server";
import markets from "@/config/markets.json";

export type ReviewState = { error?: string } | undefined;

const countryCodes = markets.countries.map((c) => c.code) as [string, ...string[]];
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const reviewSchema = z.object({
  job_id: z.string().min(1),
  title: opt(160),
  employer_name: opt(160),
  city: opt(80),
  state: opt(80),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .transform((v) => v || null),
  channel: z.enum(["email", "form", "portal", "whatsapp", "in_person", "unknown"]),
  email: opt(160),
  subject_format: opt(200),
  url: opt(400),
  destination: z.enum(countryCodes),
  removed_filters: z.array(z.coerce.number().int().min(0)).max(20),
});

/**
 * Saves the user's corrections to the parsed job (screen 11) and moves on to the
 * check. A country the user picks is kept for this job and never overwritten.
 */
export async function saveJobReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const parsed = reviewSchema.safeParse({
    job_id: formData.get("job_id"),
    title: formData.get("title") ?? "",
    employer_name: formData.get("employer_name") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    deadline: formData.get("deadline") ?? "",
    channel: formData.get("channel"),
    email: formData.get("email") ?? "",
    subject_format: formData.get("subject_format") ?? "",
    url: formData.get("url") ?? "",
    destination: formData.get("destination"),
    removed_filters: formData.getAll("removed_filter"),
  });
  if (!parsed.success) return { error: "Check the highlighted fields and try again." };
  const r = parsed.data;
  if (!r.title) return { error: "Add the job title so we know what you're applying for." };
  if (r.channel === "email" && r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return { error: "That email address doesn't look complete. Check it against the post." };
  if (viewer.preview) redirect(`/jobs/${r.job_id}/check`);

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("parsed, destination_country").eq("id", r.job_id).eq("user_id", viewer.id).maybeSingle();
  const current = jobSchema.safeParse(job?.parsed);
  if (!job || !current.success) return { error: "We couldn't find this job. Add it again." };

  const next = {
    ...current.data,
    title: r.title,
    employer_name: r.employer_name,
    location: { ...current.data.location, city: r.city, state: r.state },
    deadline: r.deadline,
    how_to_apply: { ...current.data.how_to_apply, channel: r.channel, email: r.email, subject_format: r.subject_format, url: r.url },
    hard_filters: current.data.hard_filters.filter((_, i) => !r.removed_filters.includes(i)),
  };
  const changedByUser = r.destination !== job.destination_country;
  const dest = detectDestination({ ...next, location: { ...next.location, country_code: r.destination } }, viewer.targetMarkets);
  const { error } = await supabase
    .from("jobs")
    .update({
      parsed: next,
      deadline: r.deadline,
      destination_country: r.destination,
      ...(changedByUser ? { destination_set_by_user: true, destination_confidence: 1 } : {}),
      reviewed_at: new Date().toISOString(),
      state: "reviewed",
    })
    .eq("id", r.job_id)
    .eq("user_id", viewer.id);
  if (error) return { error: "We couldn't save your changes. Try again." };

  await track(
    "destination_detected",
    { country: r.destination, confidence_band: dest.confidence >= 0.8 ? "high" : dest.confidence >= 0.5 ? "ask" : "low", changed_by_user: changedByUser },
    viewer.id,
  );
  if (dest.fallbackNote) await track("country_requested", { country: r.destination }, viewer.id);
  redirect(`/jobs/${r.job_id}/check`);
}
