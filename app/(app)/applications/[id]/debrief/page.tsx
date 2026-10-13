import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getApplication } from "@/lib/applications/data";
import { getDebrief } from "@/lib/applications/debrief";
import { voiceEnabled } from "@/lib/speech";
import { DebriefForm } from "@/components/applications/debrief-form";
import { ArrowLeft2 } from "@/components/icons";

export const metadata: Metadata = { title: "Interview notes" };

export default async function DebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireReadyViewer();
  const app = await getApplication(viewer, id);
  if (!app) notFound();
  const existing = await getDebrief(viewer, app.id);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link href={`/applications/${app.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
        <ArrowLeft2 size={16} />
        {app.title}
      </Link>
      <header className="animate-rise">
        <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">How did it go?</h1>
        <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">
          Talk or type for two minutes about your interview with {app.employer}. We&apos;ll pull out the questions so you can practise them next time.
        </p>
      </header>
      <DebriefForm applicationId={app.id} voice={voiceEnabled()} existing={existing} />
    </div>
  );
}
