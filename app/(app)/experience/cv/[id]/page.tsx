import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getCvById } from "@/lib/cv/data";
import { CvEditor } from "@/components/flow/cv-editor";
import { ArrowLeft2 } from "@/components/icons";

export const metadata: Metadata = { title: "Your CV" };

/**
 * The general CV from My Experience, before downloading (D-143): every line can be read,
 * edited or put back, and any line we couldn't trace is shown so it can be fixed first.
 */
export default async function GeneralCvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const cv = await getCvById(viewer, id);
  if (!cv) notFound();
  return (
    <div className="space-y-3">
      <Link href="/experience" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
        <ArrowLeft2 size={16} />
        My Experience
      </Link>
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Your CV</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">
          {cv.doc.jobTitle ? `Written for ${cv.doc.jobTitle} roles. ` : ""}Tap any line to change it. Lines marked in amber have words we couldn&apos;t trace to what you confirmed: fix them, keep them, or put back your own words before you download.
        </p>
      </header>
      <CvEditor cvId={cv.id} doc={cv.doc} preview={viewer.preview} dobToggle={false} />
    </div>
  );
}
