"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";
import { Teacher } from "@/components/icons";

/** sessionStorage key: this reminder was seen (or "Later" was chosen) in this visit. */
export const prepSeenKey = (link: string) => `prep-nudge:${link}`;

/**
 * The interview prep reminder (D-202), popped up once per visit when the person chose
 * "Later". It stays behind the bell until preparation starts.
 */
export function PrepNudge({ title, body, link }: { title: string; body: string | null; link: string }) {
  const router = useRouter();
  const path = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Already preparing: no need to ask.
    if (path === link) return;
    try {
      if (sessionStorage.getItem(prepSeenKey(link))) return;
      sessionStorage.setItem(prepSeenKey(link), "1");
    } catch {}
    ref.current?.showModal();
  }, [link, path]);
  return (
    <dialog ref={ref} aria-labelledby="prep-nudge-title" className="m-auto w-[min(92vw,440px)] rounded-[var(--radius-panel)] p-0 shadow-raised backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm open:animate-pop">
      <div className="px-5 pt-6 sm:px-7">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Teacher size={28} variant="bulk" />
        </span>
      </div>
      <ModalHeader id="prep-nudge-title" title={title} description={body ?? "Practise the likely questions and a mock interview when you have ten minutes."} onClose={() => ref.current?.close()} />
      <div className="grid gap-2 px-5 pb-6 pt-2 sm:grid-cols-2 sm:px-7">
        <Button variant="secondary" onClick={() => ref.current?.close()}>
          Not now
        </Button>
        <Button
          onClick={() => {
            ref.current?.close();
            router.push(link);
          }}
        >
          Start preparing
        </Button>
      </div>
    </dialog>
  );
}
