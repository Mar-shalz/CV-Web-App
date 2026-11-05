import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extAllow, extUser } from "@/lib/ext/auth";
import { extViewer } from "@/lib/ext/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { withClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs/data";
import { getContact, getLatestCv } from "@/lib/cv/data";
import { getVault } from "@/lib/vault/data";
import { getApplicationForJob } from "@/lib/applications/data";
import { formatPhone, shortUrl } from "@/lib/cv/generate";
import { finalDoc } from "@/lib/cv/types";
import { PROFILES } from "@/lib/cv/profiles";
import { lockLine, type LockSource } from "@/lib/rules/fact-lock";
import { runTask } from "@/lib/ai";
import { classify, splitName, type FieldKind } from "@/lib/autofill/fields";

export const maxDuration = 120;

const body = z.object({
  jobId: z.string().max(64).nullable().optional(),
  pageUrl: z.string().max(2000).optional(),
  fields: z
    .array(z.object({ key: z.string().max(40), label: z.string().max(400), type: z.string().max(20), autocomplete: z.string().max(60).nullable().optional(), name: z.string().max(120).nullable().optional(), placeholder: z.string().max(200).nullable().optional() }))
    .max(80),
});

type Value = { key: string; value: string; kind: FieldKind; review: boolean };

/** Sentences with a number or date the proof doesn't have are left out (the fact lock's rule). */
function keepTraced(text: string, known: LockSource): string {
  const bad = lockLine(text, [known]).filter((f) => f.type === "number" || f.type === "date").map((f) => f.token);
  if (!bad.length) return text;
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !bad.some((t) => s.includes(t)))
    .join(" ")
    .trim();
}

/**
 * Filling an employer's application form from the extension (founder round 35, D-206).
 * The panel reads the form's fields; this says what goes in each, from the person's own
 * details, their CV for this job and its email or cover note. Written questions get a
 * first draft from their accepted CV lines, always marked for them to read. Never
 * filled: date of birth, gender, state of origin and other personal details, salary,
 * passwords. Nothing is submitted: the person presses Submit on the employer's page.
 */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "We couldn't read that form. Try again." }, { status: 400 });
  const { jobId, fields } = parsed.data;
  const kinds = fields.map((f) => ({ f, kind: classify({ ...f, autocomplete: f.autocomplete ?? null, name: f.name ?? null, placeholder: f.placeholder ?? null }) }));

  if (user.preview) {
    const sample: Partial<Record<FieldKind, string>> = { first_name: "Tolu", last_name: "Adebayo", full_name: "Tolu Adebayo", email: "tolu.adebayo@gmail.com", phone: "+234 803 000 0000", city: "Yaba", region: "Lagos", question: "During SIWES at a bank branch I opened about 15 customer accounts a day and checked every customer's documents first. That habit of getting the details right is what this role asks for." };
    return NextResponse.json({ ok: true, values: kinds.flatMap(({ f, kind }) => (sample[kind] ? [{ key: f.key, value: sample[kind], kind, review: kind === "question" }] : [])), cv: null, skipped: kinds.filter((k) => k.kind === "personal").length });
  }
  if (!(await extAllow(user.id, "ext_fill"))) return NextResponse.json({ ok: false, error: "You've filled a lot of forms in the last hour. Try again soon." }, { status: 429 });

  const db = createAdminClient();
  const viewer = await extViewer(db, user);
  try {
    const out = await withClient(db, async () => {
      const [contact, vault] = await Promise.all([getContact(viewer), getVault(viewer)]);
      const job = jobId && z.uuid().safeParse(jobId).success ? await getJob(viewer, jobId).catch(() => null) : null;
      const cv = job ? await getLatestCv(viewer, job.id) : null;
      const app = job ? await getApplicationForJob(viewer, job.id) : null;
      const recent = vault.roles.filter((r) => r.confirmed && r.kind === "job").sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0) || (b.start ?? "").localeCompare(a.start ?? ""))[0];
      const school = vault.roles.filter((r) => r.confirmed && r.kind === "education").sort((a, b) => (b.end ?? b.start ?? "").localeCompare(a.end ?? a.start ?? ""))[0];
      const { first, last } = splitName(contact.fullName ?? viewer.fullName);
      const letter = app?.pack?.coverLetter ? app.pack.coverLetter.paragraphs.join("\n\n") : (app?.pack?.body ?? null);
      const direct: Partial<Record<FieldKind, string | null>> = {
        first_name: first || null,
        last_name: last || null,
        full_name: contact.fullName ?? viewer.fullName,
        email: contact.email,
        phone: formatPhone(contact.phone),
        city: contact.city,
        region: contact.state,
        linkedin: contact.linkedin ? `https://${shortUrl(contact.linkedin)}` : null,
        website: contact.portfolio ?? contact.website ?? null,
        current_title: recent?.title ?? null,
        current_employer: recent?.organisation ?? null,
        school: school?.organisation ?? null,
        qualification: school?.title ?? null,
        cover_letter: letter,
      };
      const values: Value[] = kinds.flatMap(({ f, kind }) => (direct[kind] ? [{ key: f.key, value: String(direct[kind]).slice(0, 5000), kind, review: kind === "cover_letter" }] : []));

      // Written questions: first drafts from the CV they're sending for this job. A cover
      // letter box is one too when no email was prepared (applying by form, D-218).
      const questions = kinds.filter((k) => k.kind === "question" || (k.kind === "cover_letter" && !letter)).slice(0, 8);
      if (questions.length && cv && job) {
        const doc = finalDoc(cv.doc);
        const lines = [doc.summary.text, ...doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets.filter((b) => !b.flags.some((x) => x.status === "open")).map((b) => b.text)) : []))].filter(Boolean).slice(0, 20);
        const proof = lines.map((text, n) => ({ id: `p${n + 1}`, text: text.slice(0, 500) }));
        const known: LockSource = { id: "proof", text: [...lines, job.parsed.title, job.parsed.employer_name, ...job.parsed.requirements.map((r) => r.text)].filter(Boolean).join(" \n "), sourceQuote: null, metrics: [], ownership: "did", skills: [], role: { kind: "profile", organisation: null, title: null, location: null, start: null, end: null, grade: null } };
        const res = await runTask(
          "form_answers",
          {
            job: { title: job.parsed.title ?? "the role", employer: job.parsed.employer_name ?? "the employer", requirements: job.parsed.requirements.map((r) => r.text).slice(0, 10) },
            name: contact.fullName ?? viewer.fullName ?? "the applicant",
            proof,
            spelling: PROFILES[job.destination.profile].spelling,
            questions: questions.map(({ f }) => ({ key: f.key, text: f.label.slice(0, 400) })),
          },
          { userId: viewer.id },
        );
        if (res.ok) {
          for (const a of res.data.answers) {
            const text = keepTraced(a.text.replace(/\s*\u2014\s*/g, ", ").trim(), known);
            if (text.length >= 20 && questions.some((q) => q.f.key === a.key)) values.push({ key: a.key, value: text, kind: "question", review: true });
          }
        }
      }
      return { values, cv: cv ? { cvId: cv.id, file: `${cv.doc.fileBase}.pdf` } : null, skipped: kinds.filter((k) => k.kind === "personal").length, needsCv: questions.length > 0 && !cv };
    });
    return NextResponse.json({ ok: true, ...out });
  } catch {
    return NextResponse.json({ ok: false, error: "We couldn't fill this form just now. Try again." }, { status: 500 });
  }
}
