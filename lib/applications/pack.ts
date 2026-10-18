import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import type { JobView } from "@/lib/jobs/data";
import type { CvRecord } from "@/lib/cv/data";
import { getContact } from "@/lib/cv/data";
import { finalDoc } from "@/lib/cv/types";
import { formatPhone } from "@/lib/cv/generate";
import { runTask } from "@/lib/ai";
import { fillSubject } from "@/lib/pack/subject";
import { formatEmailBody } from "@/lib/pack/body";
import { lintCopy } from "@/lib/copy-lint";
import { matchAgency } from "@/lib/rules/scam/layer1";
import { canTransition } from "@/lib/rules/status-flow";
import { nextCheckIn, scheduleKind } from "./schedule";
import { getApplication } from "./data";
import { track } from "@/lib/analytics/server";
import { APP } from "@/lib/config";
import { lockLine, type LockSource } from "@/lib/rules/fact-lock";
import { unsupportedPurposes } from "@/lib/cv/quality";
import { asksForLetter, buildLetter, cleanParagraphs, letterFileBase, templateParagraphs, type CoverLetter } from "@/lib/pack/letter";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** When the model is unavailable: short, specific, and still worth reading (D-170). */
function templateBody(name: string, role: string, employer: string | null, phone: string | null, email: string | null, proof: string[]): string {
  const [first, second] = proof.slice(1).length ? proof.slice(1) : proof;
  const lines = [
    `Dear Hiring Team,`,
    ``,
    `I'm applying for the ${role} role${employer ? ` at ${employer}` : ""}.${proof[0] ? ` ${proof[0]}` : ""}`,
    ...(first ? [``, `${first}${second && second !== first ? ` ${second}` : ""}`] : []),
    ``,
    `My CV is attached. I'd welcome the chance to talk about how I can help your team.`,
    ``,
    `Kind regards,`,
    name,
  ];
  if (phone) lines.push(phone);
  if (email) lines.push(email);
  return lines.join("\n");
}

type Draft = {
  channel: "email" | "form" | "portal";
  subject: string;
  body: string;
  checklist: { item: string; required: boolean }[];
  attachments: string[];
  formFields: { label: string; hint: string }[];
  portalSteps: string[];
  coverLetter: CoverLetter | null;
};

const todayLagos = () => new Intl.DateTimeFormat("en-CA", { timeZone: APP.timezone }).format(new Date());
/** Verbs that say the person was in charge: only when the proof says so (fact lock rule). */
const LEAD_VERBS = /\b(led|managed|headed|oversaw|directed|supervised|spearheaded)\b/gi;
/** Phrases that read as filler in an application (round 25 live test). */
const PACK_FILLER = /\b(i am writing to|i'm writing to|strong work ethic|hard[- ]?working|team player|i believe|i am confident|please find attached|positions me well|without error|go[- ]getter|self[- ]starter|highly motivated)\b/gi;

/** Drops sentences that carry a number or date the proof doesn't have (D-186). */
function dropSentencesWith(text: string, tokens: string[]): string {
  if (!tokens.length) return text;
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !tokens.some((t) => sentence.includes(t)))
    .join(" ")
    .trim();
}

/**
 * Writes the email (and the cover letter when wanted) from the CV's accepted lines. Every
 * number and date is checked against that proof; a draft with any goes back once (D-186).
 */
async function draftPack(viewer: Viewer, job: JobView, cv: CvRecord, gapNote: string | null, wantsLetter: boolean): Promise<Draft> {
  const contact = await getContact(viewer);
  const name = contact.fullName ?? viewer.fullName ?? "Applicant";
  const role = job.parsed.title ?? "the role";
  const phone = formatPhone(contact.phone);
  const course = cv.doc.sections.find((s) => s.key === "education");
  const firstQualification = course?.kind === "entries" ? course.entries[0]?.title : course?.kind === "lines" ? course.lines[0]?.split(" · ")[0] : undefined;
  const courseTitle = firstQualification?.replace(/^(BSc|BA|BEng|HND|B\.Sc\.?|MSc|B\.A\.?)\s+/i, "").replace(/\s*\(.*\)$/, "") ?? null;
  // The email draws on what the CV file says: accepted suggestions only (D-163).
  const sentDoc = finalDoc(cv.doc);
  const proof = [
    sentDoc.summary.text,
    ...sentDoc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets.filter((b) => !b.flags.some((f) => f.status === "open")).map((b) => b.text)) : [])),
  ]
    .filter(Boolean)
    .slice(0, wantsLetter ? 8 : 6);
  const subject = fillSubject(job.parsed.how_to_apply.subject_format, { fullName: name, role, course: courseTitle });
  const channel = job.parsed.how_to_apply.channel === "form" ? "form" : job.parsed.how_to_apply.channel === "portal" ? "portal" : "email";
  const cvFile = `${cv.doc.fileBase}.pdf`;
  const letterFile = `${letterFileBase(cv.doc.fileBase)}.pdf`;
  const employer = job.parsed.employer_name ?? null;
  const requirements = job.parsed.requirements.filter((r) => r.importance === "must").map((r) => r.text).slice(0, 4);

  // What a number or date may come from: the proof, the CV title line, the course and the job.
  const known: LockSource = {
    id: "proof",
    text: [...proof, cv.doc.titleLine, courseTitle, role, employer, ...requirements, job.parsed.how_to_apply.subject_format].filter(Boolean).join(" \n "),
    sourceQuote: null,
    metrics: [],
    ownership: "did",
    skills: [],
    role: { kind: "profile", organisation: null, title: null, location: null, start: null, end: null, grade: null },
  };
  // Truth: numbers, dates and "in charge" verbs must come from the proof. Those go back once,
  // and any sentence still carrying one is dropped.
  const proofText = known.text.toLowerCase();
  const untraced = (text: string) => [
    ...lockLine(text, [known]).filter((f) => f.type === "number" || f.type === "date").map((f) => f.token),
    ...[...text.matchAll(LEAD_VERBS)].map((m) => m[0]).filter((v) => !proofText.includes(v.toLowerCase())),
    // An added purpose or result ("ensuring that entries matched") the proof doesn't state (D-185).
    ...unsupportedPurposes(text, known.text),
  ];
  const problemsIn = (d: { body: string; cover_letter: string[] }) => [...new Set([...untraced(d.body), ...d.cover_letter.flatMap(untraced)])];
  // Craft: filler recruiters skim past. It goes back once with the truth problems.
  const fillerIn = (d: { body: string; cover_letter: string[] }) => [...new Set([d.body, ...d.cover_letter].flatMap((t) => [...t.matchAll(PACK_FILLER)].map((m) => m[0])))];
  // Length: a thin email undersells the person (live test, round 26: 91 words from good proof).
  const lengthIn = (d: { body: string; cover_letter: string[] }) => {
    const n = words(d.body);
    const [min, max] = wantsLetter ? [60, 140] : [150, 250];
    return n < min ? [`The email is ${n} words. Write ${wantsLetter ? "70 to 120" : "170 to 230"}: use more of the proof, with its numbers and setting, and say why it matters for this job.`] : n > max ? [`The email is ${n} words. Cut it to ${wantsLetter ? "70 to 120" : "170 to 230"}.`] : [];
  };

  // What the employer asked for (light model) and the email itself (D-188) run side by side.
  const extractP = runTask(
    "build_pack",
    {
      person: { full_name: name, course: courseTitle },
      job: { title: role, employer: employer ?? "the employer", channel, email: job.parsed.how_to_apply.email, url: job.parsed.how_to_apply.url, required_documents: job.parsed.how_to_apply.required_documents },
      cv_file: cvFile,
    },
    { userId: viewer.id },
  );
  const run = (previous: string[]) =>
    runTask(
      "write_email",
      {
        person: { full_name: name, course: courseTitle, title_line: cv.doc.titleLine || null },
        requirements,
        spelling: cv.doc.format === "us" ? "American English" : "British English",
        job: { title: role, employer: employer ?? "the employer", level: job.parsed.experience_level === "unknown" ? null : job.parsed.experience_level.replace(/_/g, " "), summary: job.rawText ? job.rawText.replace(/\s+/g, " ").slice(0, 1200) : null },
        proof,
        gap_note: gapNote,
        letter: wantsLetter,
        previous_problems: previous,
      },
      { userId: viewer.id },
    );
  let res = await run([]);
  let problems = res.ok ? problemsIn(res.data) : [];
  const filler = res.ok ? [...fillerIn(res.data), ...lengthIn(res.data)] : [];
  if (res.ok && (problems.length || filler.length)) {
    const notes = [
      ...problems.map((t) => `"${t}" is not in their proof. Leave it out, or use the proof's own figure or verb.`),
      ...filler.map((t) => (t.startsWith("The email is") ? t : `"${t}" is filler. Say something specific from the proof instead.`)),
    ];
    const again = await run(notes.slice(0, 12));
    const score = (d: { body: string; cover_letter: string[] }) => problemsIn(d).length * 3 + fillerIn(d).length + lengthIn(d).length;
    if (again.ok && score(again.data) < problems.length * 3 + filler.length) {
      res = again;
      problems = problemsIn(again.data);
    }
  }
  const extract = await extractP;

  let body = res.ok ? dropSentencesWith(res.data.body.replace(/\s*\u2014\s*/g, ", "), problems) : templateBody(name, role, employer, phone, contact.email, proof);
  if (lintCopy(body).length || words(body) > 270 || words(body) < 30) body = templateBody(name, role, employer, phone, contact.email, proof);
  body = formatEmailBody(body, { name, phone, email: contact.email });

  let coverLetter: CoverLetter | null = null;
  if (wantsLetter) {
    let paragraphs = res.ok ? cleanParagraphs(res.data.cover_letter, name).map((p) => dropSentencesWith(p, problems)).filter((p) => p.length > 20) : [];
    if (paragraphs.length < 3 || paragraphs.some((p) => lintCopy(p).length)) paragraphs = templateParagraphs(role, employer, proof);
    coverLetter = buildLetter({ paragraphs, name, phone, email: contact.email, place: [contact.city, contact.state].filter(Boolean).join(", ") || null, employer, role, today: todayLagos(), format: cv.doc.format });
  }

  const isLetter = (t: string) => /cover(ing)?\s+letter|application\s+letter/i.test(t);
  const checklist = extract.ok && extract.data.checklist.length ? extract.data.checklist : [{ item: "Your CV as a PDF", required: true }, ...job.parsed.how_to_apply.required_documents.filter((d) => !/^cv$|resume|curriculum/i.test(d)).map((d) => ({ item: d, required: true }))];
  if (coverLetter) {
    const at = checklist.findIndex((c) => /\bcv\b|resume|curriculum/i.test(c.item));
    const rest = checklist.filter((c) => !isLetter(c.item));
    rest.splice(Math.max(0, at + 1), 0, { item: "Your cover letter (ready below)", required: true });
    checklist.splice(0, checklist.length, ...rest);
  }
  if (job.parsed.how_to_apply.subject_format) checklist.unshift({ item: "Use the exact subject line above", required: true });
  const others = extract.ok ? extract.data.attachment_names.filter((a) => a !== cvFile && !(coverLetter && isLetter(a.replace(/_/g, " ")))) : [];
  const attachments = [cvFile, ...(coverLetter ? [letterFile] : []), ...others];

  return {
    channel,
    subject,
    body,
    checklist: checklist.slice(0, 10),
    attachments: attachments.slice(0, 8),
    formFields: extract.ok ? extract.data.form_fields : [],
    portalSteps: extract.ok ? extract.data.portal_steps : [],
    coverLetter,
  };
}

/**
 * The application pack for the job's channel (Build pack screen 16). The subject line
 * is filled by code from the post's own format, so it is exactly what they asked for.
 * A cover letter comes with it only when the job asks for one (D-186, D-190).
 */
export async function ensurePack(viewer: Viewer, job: JobView, cv: CvRecord, gapNote: string | null, opts: { fresh?: boolean; letter?: boolean } = {}): Promise<{ applicationId: string } | { error: string }> {
  const supabase = await createClient();
  // Already sent: show that application, never start a second one for the same job.
  const { data: sent } = await supabase.from("applications").select("id").eq("job_id", job.id).eq("user_id", viewer.id).not("sent_at", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (sent) return { applicationId: sent.id };
  let { data: app } = await supabase.from("applications").select("id, status, pack_id, cv_version_id").eq("job_id", job.id).eq("user_id", viewer.id).in("status", ["draft", "packed"]).maybeSingle();
  if (!app) {
    const { data, error } = await supabase.from("applications").insert({ user_id: viewer.id, job_id: job.id, cv_version_id: cv.id, status: "draft" }).select("id, status, pack_id, cv_version_id").single();
    if (error || !data) return { error: "We couldn't start this application. Try again." };
    app = data;
  }
  // "Write it again" (D-170) makes a new email for the same CV.
  if (app.pack_id && app.cv_version_id === cv.id && !opts.fresh) return { applicationId: app.id };

  // A rewrite keeps a letter the pack already had.
  let hadLetter = false;
  if (app.pack_id) {
    const { data: old } = await supabase.from("application_packs").select("*").eq("id", app.pack_id).eq("user_id", viewer.id).maybeSingle();
    hadLetter = Boolean((old as { cover_letter?: unknown } | null)?.cover_letter);
  }
  const wantsLetter = opts.letter ?? (hadLetter || asksForLetter(job.parsed.how_to_apply.required_documents, job.rawText));
  const d = await draftPack(viewer, job, cv, gapNote, wantsLetter);

  const row = {
    user_id: viewer.id,
    cv_version_id: cv.id,
    channel: d.channel,
    to_email: job.parsed.how_to_apply.email,
    subject: d.subject,
    body: d.body,
    attachment_names: d.attachments,
    form_fields: d.formFields,
    checklist: d.checklist,
    portal_steps: d.portalSteps,
    apply_url: job.parsed.how_to_apply.url,
  };
  let { data: pack, error } = await supabase
    .from("application_packs")
    .insert(d.coverLetter ? ({ ...row, cover_letter: d.coverLetter } as typeof row) : row)
    .select("id")
    .single();
  // Before the round 25 database update, the pack is saved without its letter.
  if (error && d.coverLetter) ({ data: pack, error } = await supabase.from("application_packs").insert({ ...row, attachment_names: d.attachments.filter((a) => !a.includes("_Cover_Letter")) }).select("id").single());
  if (error || !pack) return { error: "We couldn't prepare your application. Try again." };

  await supabase.from("applications").update({ pack_id: pack.id, cv_version_id: cv.id, status: "packed" }).eq("id", app.id).eq("user_id", viewer.id);
  if (app.status === "draft") await supabase.from("outcome_events").insert({ application_id: app.id, user_id: viewer.id, from_status: "draft", to_status: "packed", source: "tap" });
  await track("pack_opened", { channel: d.channel }, viewer.id);
  return { applicationId: app.id };
}

/**
 * "I've sent it": the job snapshot is frozen, the CV version is locked (edits make a new
 * version), and the first check in is scheduled. We never send anything ourselves.
 */
export async function markSent(viewer: Viewer, applicationId: string): Promise<{ ok: true } | { error: string }> {
  const app = await getApplication(viewer, applicationId);
  if (!app) return { error: "We couldn't find this application." };
  if (!canTransition(app.status, "sent")) return app.status === "sent" ? { ok: true } : { error: "This application can't be marked as sent." };
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("parsed, raw_text, source_url, raw_image_path, captured_at").eq("id", app.jobId).eq("user_id", viewer.id).maybeSingle();
  if (!job) return { error: "We couldn't find the job for this application." };
  const now = new Date();
  const kind = scheduleKind(job.parsed?.experience_level ?? "unknown", Boolean(matchAgency(job.parsed?.employer_name)));
  const next = nextCheckIn(kind, now, job.parsed?.deadline ?? null, 0);

  const { error } = await supabase
    .from("applications")
    .update({
      status: "sent",
      sent_at: now.toISOString(),
      job_snapshot: { parsed: job.parsed, rawText: job.raw_text, sourceUrl: job.source_url, imagePath: job.raw_image_path, capturedAt: job.captured_at },
      next_check_in_at: next?.toISOString() ?? null,
      schedule_kind: kind,
    })
    .eq("id", applicationId)
    .eq("user_id", viewer.id);
  if (error) return { error: "We couldn't save that. Try again." };
  if (app.cvId) await supabase.from("cv_versions").update({ locked_at: now.toISOString() }).eq("id", app.cvId).eq("user_id", viewer.id).is("locked_at", null);
  await supabase.from("outcome_events").insert({ application_id: applicationId, user_id: viewer.id, from_status: "packed", to_status: "sent", source: "tap" });
  await supabase.from("jobs").update({ state: "applied" }).eq("id", app.jobId).eq("user_id", viewer.id);
  await track("application_sent", { channel: app.pack?.channel ?? "email" }, viewer.id);
  return { ok: true };
}

/**
 * A tailored CV makes the job an application straight away (D-105): it shows under
 * Applications as "Not sent yet" with its CV, before the pack is built. One per job.
 */
export async function ensureDraftApplication(viewer: Viewer, job: JobView, cvId: string): Promise<void> {
  if (viewer.preview) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("applications").select("id, status").eq("job_id", job.id).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) {
    // A newer CV for a job not yet packed or sent becomes the one on the application.
    if (existing.status === "draft") await supabase.from("applications").update({ cv_version_id: cvId }).eq("id", existing.id).eq("user_id", viewer.id);
    return;
  }
  await supabase.from("applications").insert({
    user_id: viewer.id,
    job_id: job.id,
    cv_version_id: cvId,
    status: "draft",
    job_snapshot: { parsed: job.parsed, rawText: job.rawText, sourceUrl: job.sourceUrl, imagePath: null, capturedAt: job.capturedAt },
  });
}
