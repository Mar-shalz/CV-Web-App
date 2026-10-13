import type { ReactNode } from "react";
import { Add } from "@/components/icons";

/** The one close button for every modal, sheet and panel: square, small radius. */
export function ModalClose({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-ink-150 bg-white text-ink-600 transition-[color,background-color,border-color,transform] hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900 active:scale-95"
      aria-label={label}
    >
      <Add size={22} className="rotate-45" />
    </button>
  );
}

/**
 * The one modal header: the close button on its own row at the top right, then the
 * title, then the description. Never title and close on the same line.
 */
export function ModalHeader({ id, title, description, onClose, closeLabel, size = "md" }: { id: string; title: ReactNode; description?: ReactNode; onClose: () => void; closeLabel?: string; size?: "md" | "lg" }) {
  return (
    <header className="border-b border-ink-100 px-5 pb-4 pt-3 sm:px-7 sm:pt-4">
      <div className="flex justify-end">
        <ModalClose onClick={onClose} label={closeLabel} />
      </div>
      <h2 id={id} className={`mt-1 font-display font-semibold tracking-[-0.02em] text-ink-900 ${size === "lg" ? "text-xl sm:text-[1.5rem]" : "text-xl"}`}>
        {title}
      </h2>
      {description ? <div className="mt-1 text-[0.875rem] leading-5 text-ink-600 sm:text-[0.9375rem] sm:leading-6">{description}</div> : null}
    </header>
  );
}
