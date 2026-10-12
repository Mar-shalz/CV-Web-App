"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStatus } from "@/app/(app)/applications/[id]/actions";
import { Button } from "@/components/ui/button";
import { Clock, Teacher, MessageText1, Danger } from "@/components/icons";

/**
 * After 30 days with no reply we close an application quietly. Employers in Nigeria
 * often reply late, so it reopens with one tap, and an invite goes straight to
 * interview prep.
 */
export function LateReply({ applicationId, days }: { applicationId: string; days: number | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function go(to: "interview" | "assessment" | "rejected") {
    setError(null);
    start(async () => {
      const res = await setStatus(applicationId, to);
      if (!res.ok) return setError(res.error);
      if (res.shortlist || to === "assessment") router.push(`/applications/${applicationId}/shortlist`);
      else router.refresh();
    });
  }

  return (
    <section aria-labelledby="late-title" className="animate-rise rounded-[var(--radius-panel)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-75 text-ink-700">
          <Clock size={22} variant="bulk" />
        </span>
        <div className="min-w-0">
          <h2 id="late-title" className="font-display text-lg font-semibold text-ink-900">
            Heard back late?
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-600">
            {days !== null ? `No word from them in ${days} days, so we marked this No reply.` : "We marked this No reply after 30 days with no word from them."} Employers often reply late. If they did, update it here.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button onClick={() => go("interview")} disabled={busy} className="cta-sheen">
          <Teacher size={20} variant="bulk" />
          I got invited
        </Button>
        <Button variant="secondary" onClick={() => go("assessment")} disabled={busy}>
          Invited to a test
        </Button>
        <a href="#reply" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[0.9375rem] font-semibold text-brand-700 hover:bg-brand-50">
          <MessageText1 size={20} />
          Paste their message
        </a>
      </div>
      <p className="mt-3 text-xs text-ink-500">An invite opens interview prep: likely questions from the CV you sent, and practice.</p>
      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-flag-700">
          <Danger size={18} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </section>
  );
}
