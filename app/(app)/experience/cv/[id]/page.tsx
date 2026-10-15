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
      <CvEditor
        cvId={cv.id}
        doc={cv.doc}
        preview={viewer.preview}
        dobToggle={false}
        title="Your CV"
        subtitle={`${cv.doc.jobTitle ? `Written for ${cv.doc.jobTitle} roles. ` : ""}Suggested lines go on only when you accept them. Amber lines have words we couldn't trace: fix them, keep them, or use your own words.`}
      />
    </div>
  );
}
