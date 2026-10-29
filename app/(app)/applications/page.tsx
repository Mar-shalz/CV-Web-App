import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { listApplications } from "@/lib/applications/data";
import { listSavedJobs } from "@/lib/jobs/data";
import type { HomeApplication } from "@/lib/home-data";
import { RecentApplications } from "@/components/home/recent-applications";
import { ButtonLink } from "@/components/ui/button";
import { Magicpen, SearchNormal1, Receipt21, InfoCircle, AddCircle } from "@/components/icons";
import type { ApplicationStatus } from "@/lib/rules/status-flow";
import { ApplicationsBoard, type BoardCard } from "@/components/applications/board";
import { ViewSwitch } from "@/components/applications/view-switch";
import { SENT_VIA_SHORT } from "@/lib/applications/sent-via";

const PACK_CHANNEL = { email: "Email", form: "Form", portal: "Website" } as const;

export const metadata: Metadata = { title: "My Applications" };

const INVITED: ApplicationStatus[] = ["assessment", "interview", "second_interview", "offer", "accepted"];
const FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "waiting", label: "Waiting to hear", match: (a: HomeApplication) => !a.savedAt && a.status === "sent" },
  { id: "invited", label: "Invited", match: (a: HomeApplication) => !a.savedAt && INVITED.includes(a.status) },
  { id: "closed", label: "Closed", match: (a: HomeApplication) => !a.savedAt && (a.status === "rejected" || a.status === "no_response" || a.status === "withdrawn") },
  { id: "not_sent", label: "Not sent yet", match: (a: HomeApplication) => !a.savedAt && (a.status === "draft" || a.status === "packed") },
  { id: "saved", label: "Saved for later", match: (a: HomeApplication) => Boolean(a.savedAt) },
] as const;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const viewer = await requireReadyViewer();
  const { q, status } = await searchParams;
  const [all, saved] = await Promise.all([listApplications(viewer), listSavedJobs(viewer)]);
  const rows: HomeApplication[] = [
    ...all.map((a) => ({ id: a.id, title: a.title, employer: a.employer, status: a.status, sentAt: a.sentAt, channel: a.pack?.channel ?? null })),
    ...saved.map((j) => ({ id: j.id, title: j.title, employer: j.employer, status: "draft" as const, sentAt: null, channel: null, savedAt: j.savedAt })),
  ];

  const query = q?.trim().toLowerCase();
  const active = FILTERS.find((f) => f.id === status) ?? FILTERS[0];
  const items = rows.filter((a) => active.match(a)).filter((a) => !query || `${a.title} ${a.employer}`.toLowerCase().includes(query));
  // The board shows every application (saved jobs aren't applications yet), narrowed only by the search.
  const boardCards: BoardCard[] = all
    .filter((a) => !query || `${a.title} ${a.employer}`.toLowerCase().includes(query))
    .map((a) => ({ id: a.id, title: a.title, employer: a.employer, status: a.status, sentAt: a.sentAt, via: a.sentVia ? SENT_VIA_SHORT[a.sentVia] : a.pack ? PACK_CHANNEL[a.pack.channel] : null }));
  const searchFor = (id: string) => (
    <form role="search" action="/applications" className="relative w-full sm:w-72">
      {active.id !== "all" ? <input type="hidden" name="status" value={active.id} /> : null}
      <label htmlFor={id} className="sr-only">
        Search applications
      </label>
      <SearchNormal1 size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input id={id} name="q" type="search" defaultValue={q ?? ""} placeholder="Search by job or employer" className="min-h-11 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-3 text-[0.9375rem] text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
    </form>
  );

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">My Applications</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-600">Every job you applied to, with the exact CV you sent and a copy of the post.</p>
        </div>
        <ButtonLink href="/applications/new" variant="secondary">
          <AddCircle size={20} />
          Add one you already sent
        </ButtonLink>
      </header>

      {rows.length ? (
        <ViewSwitch
          board={<ApplicationsBoard cards={boardCards} saved={saved.map((j) => ({ id: j.id, title: j.title, employer: j.employer, savedAt: j.savedAt }))} toolbar={searchFor("board-filter")} />}
          list={
        <>
          <nav aria-label="Filter by status" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {FILTERS.map((f) => {
              const on = f.id === active.id;
              const count = rows.filter((r) => f.match(r)).length;
              if (f.id === "saved" && !count && !on) return null;
              return (
                <Link
                  key={f.id}
                  href={f.id === "all" ? "/applications" : `/applications?status=${f.id}`}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${on ? "bg-brand-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-150 hover:bg-ink-75"}`}
                >
                  {f.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-white/15" : "bg-ink-75 text-ink-600"}`}>{count}</span>
                </Link>
              );
            })}
          </nav>
          {query ? (
            <p className="text-sm text-ink-600" role="status">
              {items.length} {items.length === 1 ? "result" : "results"} for &ldquo;{q}&rdquo;.{" "}
              <Link href={active.id === "all" ? "/applications" : `/applications?status=${active.id}`} className="font-semibold text-brand-700 hover:underline">
                Clear search
              </Link>
            </p>
          ) : null}
          {(active.id === "closed" || active.id === "all") && items.some((a) => a.status === "no_response") ? (
            <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-[0.8125rem] leading-5 text-brand-800">
              <InfoCircle size={18} className="mt-px shrink-0" />
              No reply after 30 days closes an application, not the door. If they get back to you later, open it and update it. An invite opens interview prep.
            </p>
          ) : null}
          <RecentApplications items={items} title={active.label === "All" ? "All applications" : active.label} showAll={false} action={searchFor("apps-filter")} empty={query ? "No matches. Try another word." : active.id === "saved" ? "No saved jobs." : "Nothing here right now."} />
        </>
          }
        />
      ) : (
        <section className="torn-edge mx-auto max-w-xl rounded-t-[var(--radius-card)] bg-paper p-8 text-center shadow-card">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-700">
            <Receipt21 size={30} variant="bulk" />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold text-ink-900">Your Applications Will Live Here</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] leading-6 text-ink-600">
            Each one keeps the job post and the exact CV you sent, so when they call you weeks later you know what they&apos;re looking at.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink href="/jobs/new">
              <Magicpen size={20} variant="bulk" />
              Tailor my CV for a job
            </ButtonLink>
            <ButtonLink href="/applications/new" variant="secondary">
              Add one you already sent
            </ButtonLink>
          </div>
        </section>
      )}
    </div>
  );
}
