import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getHomeData } from "@/lib/home-data";
import { ComingNext } from "@/components/shell/coming-next";
import { RecentApplications } from "@/components/home/recent-applications";
import { ButtonLink } from "@/components/ui/button";
import { Send2, Magicpen } from "@/components/icons";

export const metadata: Metadata = { title: "Applications" };

const FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "waiting", label: "Waiting to hear", match: (s: string) => s === "sent" },
  { id: "invited", label: "Invited", match: (s: string) => ["interview", "second_interview", "offer", "accepted"].includes(s) },
  { id: "not_selected", label: "Not selected", match: (s: string) => s === "rejected" || s === "no_response" },
  { id: "not_sent", label: "Not sent yet", match: (s: string) => s === "draft" || s === "packed" },
] as const;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const viewer = await requireReadyViewer();
  const { q, status } = await searchParams;

  if (!viewer.preview) {
    return (
      <ComingNext
        title="Applications"
        intro="Every application you send, with the exact CV and a copy of the job post, even after the advert is taken down."
        slice="Slice 6"
        icon={<Send2 size={22} variant="bulk" />}
        points={[
          "See where each application stands, updated with one tap or by pasting the employer's reply.",
          "Open the CV you sent and the job post, even offline.",
          "An interview invite opens interview prep, built from what you actually sent.",
        ]}
      />
    );
  }

  const data = await getHomeData(viewer);
  const query = q?.trim().toLowerCase();
  const active = FILTERS.find((f) => f.id === status) ?? FILTERS[0];
  const items = data.recent
    .filter((a) => active.match(a.status))
    .filter((a) => !query || `${a.title} ${a.employer}`.toLowerCase().includes(query));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Applications</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-600">Every job you applied to, with the exact CV you sent.</p>
        </div>
        <ButtonLink href="/jobs/new">
          <Magicpen size={20} variant="bulk" />
          Tailor my CV
        </ButtonLink>
      </header>
      <nav aria-label="Filter by status" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTERS.map((f) => {
          const on = f.id === active.id;
          return (
            <Link
              key={f.id}
              href={f.id === "all" ? "/applications" : `/applications?status=${f.id}`}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                on ? "bg-brand-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-150 hover:bg-ink-75"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>
      {query ? (
        <p className="text-sm text-ink-600">
          {items.length} {items.length === 1 ? "result" : "results"} for &ldquo;{q}&rdquo;.{" "}
          <Link href="/applications" className="font-semibold text-brand-700 hover:underline">
            Clear search
          </Link>
        </p>
      ) : null}
      {items.length ? (
        <RecentApplications items={items} title={`${active.label} (${items.length})`} showAll={false} />
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-ink-300 p-8 text-center text-ink-600">Nothing here yet.</p>
      )}
    </div>
  );
}
