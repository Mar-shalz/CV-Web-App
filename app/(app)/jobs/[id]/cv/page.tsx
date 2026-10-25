import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getJob } from "@/lib/jobs/data";
import { getLatestCv } from "@/lib/cv/data";
import { PROFILES } from "@/lib/cv/profiles";
import { PROFILE_LABELS } from "@/lib/rules/destination";
import { FlowSteps } from "@/components/flow/flow-steps";
import { CvEditor } from "@/components/flow/cv-editor";
import { GenerateCv } from "@/components/flow/generate-cv";
import { RemakeCv } from "@/components/flow/remake-cv";
import { getApplicationForJob } from "@/lib/applications/data";

// Writing a CV can take two writer passes plus the summary writer, with the most thinking (D-185, round 28).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Your Tailored CV" };

export default async function CvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const job = await getJob(viewer, id);
  const cv = await getLatestCv(viewer, job.id);
  // The CV on screen keeps the format it was made in, until the person makes it again.
  const shown = cv?.doc.format ?? job.destination.profile;
  const profile = PROFILES[shown];
  // Date of birth is offered only when the format allows it and this job asks for it or has an age limit.
  const jobAsksDob = job.parsed.hard_filters.some((f) => f.type === "max_age") || job.parsed.how_to_apply.required_documents.some((d) => /date of birth|age/i.test(d));
  const dobToggle = profile.personal_fields.date_of_birth !== "never" && jobAsksDob;
  const app = cv ? await getApplicationForJob(viewer, job.id) : null;
  const sent = Boolean(app?.sentAt && app.status !== "draft" && app.status !== "packed");
  const subtitle = `For ${job.parsed.title ?? "this job"}${job.parsed.employer_name ? ` at ${job.parsed.employer_name}` : ""}. Written only from your experience, in the ${PROFILE_LABELS[shown]} format.`;

  return (
    <div className="space-y-3">
      <FlowSteps current="cv" hrefs={{ add: `/jobs/${job.id}`, check: `/jobs/${job.id}/check` }} back={`/jobs/${job.id}/check`} />
      {cv ? (
        <>
          {/* The format changed after this CV was made (D-198): offer it again in the new one. */}
          {cv.doc.format !== job.destination.profile && !sent ? <RemakeCv jobId={job.id} from={PROFILE_LABELS[cv.doc.format] ?? "earlier"} to={PROFILE_LABELS[job.destination.profile]} /> : null}
          <CvEditor
            cvId={cv.id}
            doc={cv.doc}
            jobId={job.id}
            preview={viewer.preview}
            dobToggle={dobToggle}
            title="Your Tailored CV"
            subtitle={subtitle}
            format={job.destination.profile}
            send={{ channel: job.parsed.how_to_apply.channel, applicationId: app?.id ?? null, sentAt: sent ? app?.sentAt ?? null : null, sentVia: app?.sentVia ?? null }}
          />
        </>
      ) : (
        <>
          <header className="animate-rise">
            <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Your Tailored CV</h1>
            <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">
              For {job.parsed.title ?? "this job"}
              {job.parsed.employer_name ? ` at ${job.parsed.employer_name}` : ""}. Written only from your experience, in the {PROFILE_LABELS[job.destination.profile]} format.
            </p>
          </header>
          <GenerateCv jobId={job.id} />
        </>
      )}
    </div>
  );
}
