/**
 * Shown the moment a link is tapped, while the server builds the next page, so the
 * screen answers straight away. Shapes match a typical page: title, intro, cards.
 */
export function PageSkeleton({ variant = "app" }: { variant?: "app" | "admin" }) {
  const block = "rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card";
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">Loading</span>
      <div className="space-y-2.5">
        <div className="h-8 w-56 max-w-[70%] rounded-lg bg-ink-100" />
        <div className="h-4 w-96 max-w-[90%] rounded bg-ink-75" />
      </div>
      {variant === "admin" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-28 p-4`}>
              <div className="h-3 w-24 rounded bg-ink-100" />
              <div className="mt-4 h-7 w-16 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      ) : null}
      <div className={`${block} p-5`}>
        <div className="flex items-center gap-4">
          <div className="size-12 shrink-0 rounded-2xl bg-ink-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 max-w-[80%] rounded bg-ink-100" />
            <div className="h-3 w-72 max-w-[95%] rounded bg-ink-75" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`${block} space-y-3 p-5`}>
            <div className="h-4 w-40 rounded bg-ink-100" />
            <div className="h-3 w-full rounded bg-ink-75" />
            <div className="h-3 w-5/6 rounded bg-ink-75" />
            <div className="h-3 w-2/3 rounded bg-ink-75" />
          </div>
        ))}
      </div>
    </div>
  );
}
