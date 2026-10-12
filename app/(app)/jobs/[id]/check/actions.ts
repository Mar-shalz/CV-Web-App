"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { writeSensitive } from "@/lib/sensitive";
import { track } from "@/lib/analytics/server";

export type DetailState = { error?: string; ok?: boolean } | undefined;

const jobId = z.string().min(1).max(64);

/**
 * The missing details sheet (screen 13): asks for one detail a rule needs, says why,
 * and saves it once. Sensitive details are encrypted and kept apart.
 */
export async function saveDetail(_prev: DetailState, formData: FormData): Promise<DetailState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const kind = String(formData.get("kind"));
  const id = jobId.safeParse(formData.get("job_id"));
  if (!id.success) return { error: "Something went wrong. Reload the page." };
  if (viewer.preview) return { ok: true };
  const supabase = await createClient();
  const done = () => {
    revalidatePath(`/jobs/${id.data}/check`);
    return { ok: true };
  };

  switch (kind) {
    case "date_of_birth": {
      const dob = String(formData.get("date_of_birth") ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob > new Date().toISOString().slice(0, 10) || dob < "1940-01-01") return { error: "Enter your date of birth." };
      return (await writeSensitive(viewer.id, { date_of_birth: dob })) ? done() : { error: "We couldn't save that securely. Try again later." };
    }
    case "gender": {
      const g = String(formData.get("gender") ?? "");
      if (!["female", "male"].includes(g)) return { error: "Choose one, or skip this question." };
      return (await writeSensitive(viewer.id, { gender: g })) ? done() : { error: "We couldn't save that securely. Try again later." };
    }
    case "nysc_status": {
      const s = String(formData.get("nysc_status") ?? "");
      if (!["serving", "completed", "exempted"].includes(s)) return { error: "Choose your NYSC status." };
      const end = String(formData.get("nysc_end") ?? "");
      const endOk = /^\d{4}-\d{2}$/.test(end) ? `${end}-28` : null;
      if (s === "serving" && !endOk) return { error: "Add the month your service ends." };
      return (await writeSensitive(viewer.id, { nysc_status: s, nysc_end: endOk })) ? done() : { error: "We couldn't save that securely. Try again later." };
    }
    case "location": {
      const city = String(formData.get("city") ?? "").trim().slice(0, 80);
      const state = String(formData.get("state") ?? "").trim().slice(0, 80);
      if (!city && !state) return { error: "Add your city or state." };
      await supabase.from("profiles").update({ city: city || null, state: state || null }).eq("user_id", viewer.id);
      return done();
    }
    case "right_to_work": {
      const country = String(formData.get("country") ?? "").toUpperCase().slice(0, 2);
      const status = String(formData.get("status") ?? "");
      if (!/^[A-Z]{2}$/.test(country) || !["yes", "needs_sponsorship"].includes(status)) return { error: "Choose one." };
      const { data } = await supabase.from("profiles").select("right_to_work").eq("user_id", viewer.id).maybeSingle();
      await supabase.from("profiles").update({ right_to_work: { ...((data?.right_to_work as object) ?? {}), [country]: status } }).eq("user_id", viewer.id);
      return done();
    }
    case "degree_class":
    case "cgpa_scale": {
      const grade = String(formData.get("grade") ?? "").trim().slice(0, 80);
      if (!grade) return { error: "Write your class of degree or CGPA as it is on your certificate." };
      const { data: edu } = await supabase.from("vault_roles").select("id").eq("user_id", viewer.id).eq("kind", "education").order("end_date", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      if (!edu) return { error: "Add your degree in My experience first." };
      await supabase.from("vault_roles").update({ grade, confirmed: true }).eq("id", edu.id).eq("user_id", viewer.id);
      revalidatePath("/vault");
      return done();
    }
    case "licence": {
      const name = String(formData.get("name") ?? "").trim().slice(0, 120);
      const status = String(formData.get("status") ?? "");
      if (!name || !["qualified", "in progress", "part qualified"].includes(status)) return { error: "Add the name and pick a status." };
      await supabase.from("vault_roles").insert({ user_id: viewer.id, kind: "certification", title: name, grade: status, source: "text", confirmed: true });
      revalidatePath("/vault");
      return done();
    }
    case "olevel": {
      const exam = String(formData.get("exam") ?? "");
      const year = Number(formData.get("year"));
      const subjects = formData
        .getAll("subject")
        .map((s, i) => ({ name: String(s).trim().slice(0, 60), grade: String(formData.getAll("grade")[i] ?? "").toUpperCase() }))
        .filter((s) => s.name && /^[A-F][1-9]$/.test(s.grade));
      if (!["WAEC", "NECO", "GCE"].includes(exam) || !year || subjects.length < 3) return { error: "Add the exam, the year and at least three subjects with grades." };
      await supabase.from("olevel_results").insert({ user_id: viewer.id, exam, year, subjects, sittings: 1 });
      return done();
    }
    case "education":
      redirect("/vault/new");
    default:
      return { error: "Unknown detail." };
  }
}

const stateSchema = z.object({ job_id: jobId, state: z.enum(["saved", "skipped", "applying"]) });

/** Save for later, Skip, or go ahead. Building a CV after a Skip verdict is logged as an override. */
export async function setJobState(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const parsed = stateSchema.safeParse({ job_id: formData.get("job_id"), state: formData.get("state") });
  if (!parsed.success) return;
  const { job_id, state } = parsed.data;
  if (!viewer.preview) {
    const supabase = await createClient();
    await supabase.from("jobs").update({ state }).eq("id", job_id).eq("user_id", viewer.id);
    if (state === "applying" && formData.get("override") === "1") {
      await supabase.from("verdicts").update({ overridden_at: new Date().toISOString() }).eq("job_id", job_id).eq("user_id", viewer.id).is("overridden_at", null);
      await track("verdict_overridden", { verdict: "skip" }, viewer.id);
    }
  }
  if (state === "applying") redirect(`/jobs/${job_id}/cv`);
  redirect(state === "saved" ? "/applications?status=not_sent" : "/home");
}

const surveySchema = z.object({ survey: z.enum(["verdict_helpful", "send_as_is", "applied_anyway"]), answer: z.enum(["yes", "no", "small_edits"]), job_id: z.string().optional() });

/** One tap research survey. Stored as an answer only, no free text. */
export async function answerSurvey(input: z.input<typeof surveySchema>): Promise<void> {
  const viewer = await getViewer();
  const parsed = surveySchema.safeParse(input);
  if (!viewer || !parsed.success || viewer.preview) return;
  const supabase = await createClient();
  const job = parsed.data.job_id && /^[0-9a-f-]{36}$/.test(parsed.data.job_id) ? parsed.data.job_id : null;
  await supabase.from("survey_answers").insert({ user_id: viewer.id, survey: parsed.data.survey, answer: parsed.data.answer, job_id: job });
  await track("survey_answered", { survey: parsed.data.survey, answer: parsed.data.answer }, viewer.id);
}
