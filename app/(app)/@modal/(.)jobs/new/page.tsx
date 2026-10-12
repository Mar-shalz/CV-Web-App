import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { countConfirmedItems } from "@/lib/home-data";
import { LIMITS } from "@/lib/config";
import { RouteModal } from "@/components/ui/route-modal";
import { CaptureForm } from "@/components/flow/capture-form";
import { Danger, ShieldSearch, Magicpen, Send2 } from "@/components/icons";

export const metadata: Metadata = { title: "Tailor my CV" };

/** "Tailor my CV" opens over the current page. A refresh or a shared link shows the full page. */
export default async function TailorModal({ searchParams }: { searchParams: Promise<{ via?: string }> }) {
  const viewer = await requireReadyViewer();
  const { via } = await searchParams;
  const confirmed = await countConfirmedItems(viewer);
  const target = LIMITS.onboarding.vault_ready_items;
  const initial = via === "link" || via === "file" || via === "screenshot" ? via : "paste";

  return (
    <RouteModal title="Tailor your CV to a job" description="Start with the job description. The more complete it is, the better your CV will match.">
      {confirmed < target ? (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-care-50 p-3.5 text-[0.8125rem] leading-5 text-care-700">
          <Danger size={18} variant="bulk" className="mt-px shrink-0" />
          <span>
            Your CV is written only from your experience. You have {confirmed} of {target} items.{" "}
            <Link href="/vault" className="font-semibold underline underline-offset-2">
              Add more first
            </Link>
          </span>
        </p>
      ) : null}
      <CaptureForm initialMode={initial} />
      <ol className="mt-5 grid gap-2 border-t border-ink-100 pt-4 text-[0.8125rem] text-ink-600 sm:grid-cols-3">
        {[
          { icon: ShieldSearch, text: "We check the job" },
          { icon: Magicpen, text: "We tailor your CV" },
          { icon: Send2, text: "You send it yourself" },
        ].map(({ icon: Icon, text }, i) => (
          <li key={text} className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon size={16} variant="bulk" />
            </span>
            <span>
              <span className="sr-only">Step {i + 1}: </span>
              {text}
            </span>
          </li>
        ))}
      </ol>
    </RouteModal>
  );
}
