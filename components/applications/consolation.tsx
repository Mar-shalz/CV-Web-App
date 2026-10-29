"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ModalHeader } from "@/components/ui/modal-header";
import { buttonClass } from "@/components/ui/button";
import { Sun1, Magicpen, MessageText1, Book1 } from "@/components/icons";

/**
 * After "Not selected" (founder round 34, D-203): a warm word before anything else, so a
 * no doesn't stop them. Honest and specific, never "everything happens for a reason". When
 * they reached a test, an interview or an offer, it says so: their CV did its job.
 */
export function Consolation({ open, reached, employer, onClose }: { open: boolean; reached: boolean; employer: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const tips = [
    { icon: MessageText1, text: `Ask ${employer ?? "them"} for feedback in one short, polite line. Many won't reply; the ones who do often tell you exactly what to sharpen.` },
    { icon: Book1, text: "Your CV and the job post stay saved here, so the next application starts from what you've already built." },
  ];

  return (
    <dialog ref={ref} aria-labelledby="consolation-title" onClose={onClose} className="m-auto w-[min(92vw,460px)] overflow-hidden rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
      <div className="bg-gradient-to-b from-brand-50 to-white px-5 pt-6 sm:px-7">
        <span className="grid size-14 place-items-center rounded-2xl bg-white text-care-600 shadow-card">
          <Sun1 size={28} variant="bulk" />
        </span>
      </div>
      <ModalHeader
        id="consolation-title"
        title="Not this one. Keep going."
        description={
          reached
            ? "A no after getting this far stings, and it's allowed to. But remember what it means: your CV got you in the room. That part is working, and the next panel will meet a better prepared you."
            : "A no stings, and it's allowed to. It's also normal: most people hear several before a yes. It says nothing final about you, only that this one wasn't the match."
        }
        onClose={onClose}
      />
      <ul className="space-y-2 px-5 sm:px-7">
        {tips.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-2.5 rounded-2xl bg-ink-50 p-3 text-[0.8125rem] leading-5 text-ink-700">
            <Icon size={18} className="mt-px shrink-0 text-brand-700" />
            {text}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 px-5 pb-6 pt-4 sm:grid-cols-2 sm:px-7">
        <button type="button" onClick={onClose} className={buttonClass("secondary")}>
          Close
        </button>
        <Link href="/jobs/new" onClick={onClose} className={buttonClass("primary")}>
          <Magicpen size={20} variant="bulk" />
          Find the next one
        </Link>
      </div>
    </dialog>
  );
}
