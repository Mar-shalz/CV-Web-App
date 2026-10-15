import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getSharedCheck, DEMO_SHARE, type SharedCheck } from "@/lib/share";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPreviewMode } from "@/lib/env";
import { track } from "@/lib/analytics/server";
import { Logo } from "@/components/brand/logo";
import { formatDate } from "@/lib/format";
import { APP_NAME } from "@/lib/config";
import { ShieldTick, ShieldSearch, Warning2, Danger, TickCircle, CloseCircle, MinusCircle, ArrowRight } from "@/components/icons";

const STATE = {
  verified: { tone: "bg-proof-50 text-proof-700 ring-proof-100", icon: ShieldTick, title: "Looks genuine on the checks we could run" },
  unverified: { tone: "bg-care-50 text-care-700 ring-care-100", icon: Warning2, title: "Couldn't be confirmed. Be careful." },
  red_flags: { tone: "bg-flag-50 text-flag-700 ring-flag-100", icon: Danger, title: "Warning signs in this job post" },
} as const;
const CHECK = {
  pass: { icon: TickCircle, cls: "text-proof-600", word: "Yes" },
  fail: { icon: CloseCircle, cls: "text-flag-600", word: "No" },
  unknown: { icon: MinusCircle, cls: "text-ink-400", word: "Couldn't check" },
} as const;

async function load(slug: string): Promise<SharedCheck | null> {
  if (isPreviewMode()) return slug === DEMO_SHARE.slug ? DEMO_SHARE : null;
  return getSharedCheck(slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await load((await params).slug);
  if (!s) return { title: "Job check", robots: { index: false } };
  const job = [s.title, s.employer && `at ${s.employer}`].filter(Boolean).join(" ") || "A job post";
  const title = `Is this job real? ${job}`;
  const description = `${STATE[s.state].title}. See what ${APP_NAME} checked, then check your own job, free.`;
  // Shared on WhatsApp and X, never indexed: a check is about one post, not a company.
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, type: "article" }, twitter: { card: "summary_large_image", title, description } };
}

/**
 * A shared job check (D-147): the verdict on one job post and what was checked. Public, no
 * sign in, no personal data. It says plainly that it's about one post, not the company.
 */
export default async function SharedCheckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await load(slug);
  if (!s) notFound();
  if (!isPreviewMode()) {
    after(async () => {
      const db = createAdminClient();
      const { data } = await db.from("check_shares").select("views").eq("slug", slug).maybeSingle();
      if (data) await db.from("check_shares").update({ views: (data.views ?? 0) + 1 }).eq("slug", slug);
    });
    await track("check_share_opened", { state: s.state });
  }
  const st = STATE[s.state];
  const Icon = st.icon;

  return (
    <div className="min-h-dvh bg-[#f3f5fa] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-xl space-y-4">
        <Link href="/" className="inline-flex rounded-xl" aria-label={`${APP_NAME} home`}>
          <Logo />
        </Link>

        <main className="space-y-4">
          <section className="rounded-[var(--radius-panel)] border border-ink-150 bg-white p-5 shadow-card sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Job check</p>
            <h1 className="mt-1 font-display text-[1.5rem] font-semibold leading-8 tracking-[-0.02em] text-ink-900">{s.title ?? "A job post"}</h1>
            <p className="mt-0.5 text-[0.9375rem] text-ink-600">{[s.employer, s.location].filter(Boolean).join(" · ") || "Employer not named in the post"}</p>
            {s.sourceHost ? <p className="mt-1 text-xs text-ink-500">Posted on {s.sourceHost}</p> : null}

            <p className={`mt-5 flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-semibold ring-1 ${st.tone}`}>
              <Icon size={22} variant="bulk" />
              {st.title}
            </p>
            {s.headline ? <p className="mt-3 text-[0.875rem] leading-6 text-ink-700">{s.headline}</p> : null}

            {s.flags.length ? (
              <ul className="mt-3 space-y-2">
                {s.flags.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 rounded-xl bg-flag-50 p-2.5 text-[0.8125rem] leading-5 text-flag-700">
                    <Danger size={18} variant="bulk" className="mt-px shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            ) : null}

            <h2 className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">What Was Checked</h2>
            <ul className="mt-1 divide-y divide-ink-100">
              {s.checks.map((c) => {
                const m = CHECK[c.status] ?? CHECK.unknown;
                const CI = m.icon;
                return (
                  <li key={c.label} className="flex items-start gap-3 py-2.5">
                    <CI size={20} variant="bulk" className={`mt-px shrink-0 ${m.cls}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-[0.875rem] font-semibold text-ink-900">{c.label}</span>
                        <span className={`text-xs font-semibold ${m.cls}`}>{m.word}</span>
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-600">{c.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 border-t border-ink-100 pt-3 text-xs leading-5 text-ink-500">
              Checked {formatDate(s.checkedAt)}. This is about one job post, not the company named in it: scammers often use real company names. We can&apos;t prove a job is real, so never pay to apply and never share your BVN or bank PIN.
            </p>
          </section>

          <section className="brand-gradient rounded-[var(--radius-panel)] p-5 text-white shadow-raised sm:p-6">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
              <ShieldSearch size={26} variant="bulk" />
            </span>
            <h2 className="mt-3 font-display text-xl font-semibold">Check Your Own Job, Free</h2>
            <p className="mt-1 text-sm leading-6 text-white/85">Paste a job or its link. {APP_NAME} checks the company, its website and email, and who posted it, then tailors your CV to it with nothing made up.</p>
            <Link href="/sign-in" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-ink-900 hover:bg-ink-50">
              Check a job
              <ArrowRight size={18} />
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
