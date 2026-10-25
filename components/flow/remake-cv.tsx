"use client";

import { useState } from "react";
import { GenerateCv } from "./generate-cv";
import { Button } from "@/components/ui/button";
import { InfoCircle } from "@/components/icons";

/** The format changed after this CV was made (D-198): offer the same CV in the new format. The old one stays saved. */
export function RemakeCv({ jobId, from, to }: { jobId: string; from: string; to: string }) {
  const [go, setGo] = useState(false);
  if (go) return <GenerateCv jobId={jobId} />;
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
      <p className="flex items-start gap-2 text-sm leading-6 text-ink-800">
        <InfoCircle size={20} className="mt-0.5 shrink-0 text-brand-700" />
        <span>
          This CV is in the <span className="font-semibold">{from}</span> format. You picked <span className="font-semibold">{to}</span>, so headings, order, spelling and paper size change with it.
        </span>
      </p>
      <Button onClick={() => setGo(true)} className="shrink-0">
        Make it in the {to} format
      </Button>
    </section>
  );
}
