import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { LIMITS } from "@/lib/config";
import { getVault, type Vault } from "@/lib/vault/data";
import { allSkills, getExtras } from "@/lib/vault/extras";
import { captureJob } from "@/lib/jobs/capture";
import { getJob } from "@/lib/jobs/data";
import { getVerdict, runEligibility } from "@/lib/jobs/check";
import { matchPercent } from "@/lib/rules/match-score";
import { generateForJob, getLatestCv } from "@/lib/cv/data";
import { accessOf } from "@/lib/entitlements";
import { track } from "@/lib/analytics/server";
import { reachOf, type Reach } from "@/lib/markets";
import { findJobs, type FeedJob } from "./index";
import { bandFor, fresh, isNewMatch, levelFits, newestFirst, prescore, rolesFrom } from "./rank";
import { fits, sponsored } from "./place";
import { visaFromText } from "./visa";
import { stillOpen } from "./open";

// Jobs for you (founder rounds 34 to 42, D-205, D-208 to D-213). Every day, for everyone: search
// employers' own career pages and remote job boards for the roles the person goes for,
// keep jobs posted in the last 60 days, at a level they could be hired at, in the country
// they live in, remote and open to people there, or office jobs in the countries they apply
// to abroad that they can work in (their right to work, or a post offering visa sponsorship),
// check that jobs on their list are still listed, run the full fit check on every one
// worth checking, and list those they match limits.matches.min_match % or more. Searches
// are shared by people looking for the same role. With "Tailor ahead" on, CVs are written
// for the jobs on their list a few at a time (tailorPending); otherwise when they tap
// Tailor. Nothing is ever sent for them.

export type MatchRun = { ran: boolean; found: number; checked: number; matched: number; tailored?: number; reason?: "recent" | "no_roles" | "no_experience" };

const DAY = 86_400_000;

function workMonths(vault: Vault): number {
  return vault.roles
    .filter((r) => r.confirmed && r.kind === "job" && r.start)
    .reduce((sum, r) => {
      const [sy, sm] = r.start!.split("-").map(Number) as [number, number];
      const end = r.isCurrent || !r.end ? new Date().toISOString().slice(0, 7) : r.end;
      const [ey, em] = end.split("-").map(Number) as [number, number];
      return sum + Math.max(0, (ey - sy) * 12 + em - sm + 1);
    }, 0);
}

/** The text a found job is read from: what the source published, labelled, and its link. */
const postText = (j: FeedJob) => [j.title, j.employer, j.location, j.remote ? "Remote" : null, "", j.description, "", `Apply: ${j.url}`].filter((l) => l !== null).join("\n");

/**
 * One person's daily search. `db` writes the job_matches rows (closed to app users);
 * the rest runs as the person (their session, or the admin client scoped to them).
 * `minHours`: skip when their last search is more recent than this.
 */
export async function runMatches(viewer: Viewer, opts: { minHours?: number } = {}): Promise<MatchRun> {
  const begun = Date.now();
  const none = (reason?: MatchRun["reason"]): MatchRun => ({ ran: false, found: 0, checked: 0, matched: 0, reason });
  if (viewer.preview || !isSupabaseConfigured() || isPreviewMode()) return none();
  const db = createAdminClient();
  // Before migration section 26 there's nowhere to keep matches: spend nothing.
  const { error: missing } = await db.from("job_matches").select("id").limit(1);
  if (missing) return none();
  const minHours = opts.minHours ?? 20;
  const { data: me } = await db.from("users").select("matches_searched_at").eq("id", viewer.id).maybeSingle();
  const last = (me as { matches_searched_at?: string | null } | null)?.matches_searched_at;
  const supabase = await createClient();
  // Earlier checks that now clear the bar (it went from 90% to 85%): our own records, no new fit check.
  const promoted = await promoteNearMisses(viewer, supabase, db);
  if (last && Date.now() - Date.parse(last) < minHours * 3_600_000) return { ...none("recent"), matched: promoted };

  const [vault, extras, { data: recent }] = await Promise.all([
    getVault(viewer),
    getExtras(viewer),
    supabase.from("jobs").select("parsed").eq("user_id", viewer.id).neq("state", "suggested").order("captured_at", { ascending: false }).limit(20),
  ]);
  if (!vault.confirmedItems) return none("no_experience");
  const applied = (recent ?? []).map((j) => (j.parsed as { title?: string | null } | null)?.title ?? null);
  const held = vault.roles.filter((r) => r.confirmed && r.kind === "job").map((r) => r.title);
  const roles = rolesFrom(applied, held, LIMITS.matches.roles);
  if (!roles.length) return none("no_roles");

  await db.from("users").update({ matches_searched_at: new Date().toISOString() }).eq("id", viewer.id);
  // Where they live (founder round 40), and abroad when they apply there and can work there (rounds 41 and 42).
  const reach = await reachFor(viewer, supabase);
  const since = new Date(Date.now() - LIMITS.matches.max_age_days * DAY).toISOString().slice(0, 10);
  const band = bandFor(workMonths(vault));
  const skills = allSkills(extras);

  // 1. Search (shared), then keep what's fresh, at their level and in a place that suits
  // them. Jobs already seen but not checked yet stay in the running, so a job one search
  // didn't reach is checked on a later day (D-208).
  const jobs = (await findJobs(roles, [[reach.home], reach.away], since)).filter((j) => fresh(j, LIMITS.matches.max_age_days) && levelFits(j.title, band) && fits({ ...j, visa: visaFromText(j.description) }, reach));
  const { data: known } = await db.from("job_matches").select("source, source_job_id, status").eq("user_id", viewer.id).limit(5000);
  const status = new Map((known ?? []).map((k) => [`${k.source}:${k.source_job_id}`, k.status as string]));
  const open = jobs
    .filter((j) => (status.get(`${j.source}:${j.sourceId}`) ?? "found") === "found")
    .map((j) => ({ j, score: prescore(j, roles, skills), seen: status.has(`${j.source}:${j.sourceId}`) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMITS.matches.checks_per_search);
  const fresh_ = open.filter((o) => !o.seen);
  if (fresh_.length) {
    await db.from("job_matches").upsert(
      fresh_.map(({ j, score }) => ({ user_id: viewer.id, source: j.source, source_job_id: j.sourceId, title: j.title, employer: j.employer, location: j.location, remote: j.remote, posted_at: j.postedAt, url: j.url, credit: j.credit, prescore: score })),
      { onConflict: "user_id,source,source_job_id", ignoreDuplicates: true },
    );
  }

  // 2. The full fit check on every job worth one (founder round 40: no daily cap), best
  // first, a few at a time. None starts after check_seconds, so the search finishes in
  // time; the rest stay "found" and are checked on the next search.
  const picks = open.filter((f) => f.score >= 25);
  const results = await inTurn(picks, LIMITS.matches.check_parallel, begun + LIMITS.matches.check_seconds * 1000, ({ j }) => checkOne(viewer, supabase, db, j, reach).catch(() => false));
  const matched = results.filter(Boolean).length + promoted;
  await track("matches_searched", { found: fresh_.length, checked: results.length, matched }, viewer.id);

  // 3. Still listed? Jobs on their list that closed leave it, before any CV is written for them.
  if (Date.now() - begun < 150_000) await recheckOpen(viewer, db);

  // 4. Tailor ahead: CVs for the jobs on their list that don't have one yet, when there's
  // time left in this run (otherwise on their next visit or search).
  const { tailored } = Date.now() - begun < 170_000 ? await tailorPending(viewer, db) : { tailored: 0 };
  return { ran: true, found: fresh_.length, checked: results.length, matched, tailored };
}

/** Where Jobs for You looks for them, with the countries they've said they can already work in. */
async function reachFor(viewer: Viewer, client: SupabaseClient): Promise<Reach> {
  const { data } = await client.from("profiles").select("right_to_work").eq("user_id", viewer.id).maybeSingle();
  const rtw = (data as { right_to_work?: Record<string, string> | null } | null)?.right_to_work ?? {};
  return reachOf(viewer.targetMarkets, viewer.homeCountry, Object.keys(rtw).filter((c) => rtw[c] === "yes"));
}

/**
 * Still listed? (founder round 42, D-213.) Jobs on their list whose last check is
 * limits.matches.open_check_hours old, a few at a time (lib/jobfeed/open.ts). A closed job
 * leaves the list. Before migration section 28 there's nowhere to keep the answer, so
 * nothing is checked.
 */
export async function recheckOpen(viewer: Viewer, db: SupabaseClient = createAdminClient()): Promise<{ checked: number; closed: number }> {
  if (viewer.preview || !isSupabaseConfigured() || isPreviewMode()) return { checked: 0, closed: 0 };
  const { data, error } = await db.from("job_matches").select("id, source, source_job_id, url, open_state, open_checked_at").eq("user_id", viewer.id).eq("status", "matched").limit(200);
  if (error) return { checked: 0, closed: 0 };
  const due = Date.now() - LIMITS.matches.open_check_hours * 3_600_000;
  const stale = (data ?? []).filter((m) => m.open_state !== "closed" && (!m.open_checked_at || Date.parse(m.open_checked_at) < due)).slice(0, LIMITS.matches.open_checks_per_run);
  const states = await inTurn(stale, LIMITS.matches.open_check_parallel, Date.now() + 45_000, async (m) => {
    const state = await stillOpen({ source: m.source, sourceId: m.source_job_id, url: m.url });
    await db.from("job_matches").update({ open_state: state, open_checked_at: new Date().toISOString() }).eq("id", m.id).eq("user_id", viewer.id);
    return state;
  });
  return { checked: states.length, closed: states.filter((s) => s === "closed").length };
}

/** `fn` on each item, `parallel` at a time, in order; none starts after `deadline` (epoch ms). */
async function inTurn<T, R>(items: T[], parallel: number, deadline: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(parallel, items.length) }, async () => {
      while (next < items.length && Date.now() < deadline) out.push(await fn(items[next++]!));
    }),
  );
  return out;
}

export type TailorRun = { tailored: number; left: number; error?: string };

/**
 * Tailor ahead (founder rounds 35 and 38, D-209): CVs for the jobs on their list that don't
 * have one yet, best match first, limits.matches.tailor_ahead_per_run at a time. Covers
 * jobs listed before it was switched on, not only new matches. A CV already made for the
 * job is linked, not written again. Never starts someone's trial for them. `left` is how
 * many still wait; `error` says why a CV couldn't be written (the day's fair use limit).
 */
export async function tailorPending(viewer: Viewer, db: SupabaseClient = createAdminClient()): Promise<TailorRun> {
  if (viewer.preview || !isSupabaseConfigured() || isPreviewMode()) return { tailored: 0, left: 0 };
  const { data: me } = await db.from("users").select("tailor_ahead").eq("id", viewer.id).maybeSingle();
  if (!(me as { tailor_ahead?: boolean } | null)?.tailor_ahead) return { tailored: 0, left: 0 };
  const { data: waiting } = await db
    .from("job_matches")
    .select("*, job:jobs(visa:parsed->>visa_sponsorship)")
    .eq("user_id", viewer.id)
    .eq("status", "matched")
    .is("cv_version_id", null)
    .not("job_id", "is", null)
    .order("checked_at", { ascending: false })
    .limit(100);
  // In the order Jobs for You shows them, so the CVs written first are for the jobs at the top.
  const rows = listOrder((waiting ?? []) as Row[], await reachFor(viewer, db)) as (Row & { job_id: string })[];
  if (!rows.length) return { tailored: 0, left: 0 };
  const access = accessOf(viewer);
  if (access.kind === "trial_ready") return { tailored: 0, left: rows.length, error: "Tailor ahead starts with your free trial. Tap Tailor my CV on a job to start it." };
  if (access.kind === "trial_ended") return { tailored: 0, left: rows.length, error: "Your trial has ended, so Tailor ahead is paused." };

  const outcomes = await Promise.all(
    rows.slice(0, LIMITS.matches.tailor_ahead_per_run).map(async (m): Promise<string | null> => {
      try {
        let cvId = (await getLatestCv(viewer, m.job_id))?.id ?? null;
        if (!cvId) {
          const res = await generateForJob(viewer, await getJob(viewer, m.job_id));
          if (!res.ok) return res.error;
          cvId = res.cvId;
        }
        const { error } = await db.from("job_matches").update({ cv_version_id: cvId }).eq("id", m.id).eq("user_id", viewer.id);
        return error ? "We couldn't save that CV. We'll try again later." : null;
      } catch {
        return "We couldn't write that CV just now. We'll try again later.";
      }
    }),
  );
  const tailored = outcomes.filter((o) => o === null).length;
  return { tailored, left: rows.length - tailored, error: outcomes.find((o) => o !== null) ?? undefined };
}

/**
 * Jobs checked before that scored at or above the bar but were turned down only for the
 * old, higher one: listed now when their saved eligibility didn't fail and their saved fit
 * verdict wasn't "skip". Reads our records only; no fit check runs.
 */
async function promoteNearMisses(viewer: Viewer, supabase: SupabaseClient, db: SupabaseClient): Promise<number> {
  const { data: near } = await db
    .from("job_matches")
    .select("id, job_id")
    .eq("user_id", viewer.id)
    .eq("status", "not_a_match")
    .gte("match_percent", LIMITS.matches.min_match)
    .not("job_id", "is", null)
    .limit(20);
  let n = 0;
  for (const m of near ?? []) {
    const [{ data: el }, { data: v }] = await Promise.all([
      supabase.from("eligibility_results").select("overall").eq("job_id", m.job_id).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("verdicts").select("verdict").eq("job_id", m.job_id).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!el || !v || el.overall === "fail" || v.verdict === "skip") continue;
    const { error } = await db.from("job_matches").update({ status: "matched" }).eq("id", m.id).eq("user_id", viewer.id);
    if (!error) n++;
  }
  return n;
}

/**
 * Saves the job for them (as "suggested"), runs eligibility and the fit check, and records the
 * match. An office job abroad whose post, once read, doesn't offer sponsorship they'd need is
 * turned down before the fit check (founder round 42).
 */
async function checkOne(viewer: Viewer, supabase: SupabaseClient, db: SupabaseClient, j: FeedJob, reach: Reach): Promise<boolean> {
  const captured = await captureJob(supabase, viewer.id, viewer.targetMarkets, { mode: "paste", text: postText(j), sourceUrl: j.url });
  if (!captured.ok) return false;
  await supabase.from("jobs").update({ state: "suggested" }).eq("id", captured.jobId).eq("user_id", viewer.id);
  const job = await getJob(viewer, captured.jobId);
  if (!fits({ ...j, visa: job.parsed.visa_sponsorship }, reach)) {
    await db.from("job_matches").update({ status: "not_a_match", job_id: captured.jobId, checked_at: new Date().toISOString() }).eq("user_id", viewer.id).eq("source", j.source).eq("source_job_id", j.sourceId);
    return false;
  }
  const vault = await getVault(viewer);
  const eligibility = await runEligibility(viewer, job, vault);
  const verdict = await getVerdict(viewer, job, vault, eligibility);
  const pct = matchPercent(verdict.requirements, job.parsed.requirements);
  const ok = eligibility.overall !== "fail" && verdict.verdict !== "skip" && pct !== null && pct >= LIMITS.matches.min_match;
  await db
    .from("job_matches")
    .update({ status: ok ? "matched" : "not_a_match", match_percent: pct, job_id: captured.jobId, checked_at: new Date().toISOString() })
    .eq("user_id", viewer.id)
    .eq("source", j.source)
    .eq("source_job_id", j.sourceId);
  return ok;
}

type Row = { id: string; job_id: string | null; source: string; location: string | null; remote: boolean; posted_at: string | null; created_at: string | null; checked_at: string | null; match_percent: number | null; open_state?: string | null; job?: { visa: string | null } | null };

/**
 * Still open (posted in the last max_age_days, and not found closed) and in a place that suits
 * them (jobs listed before rounds 40 and 42 included), in Jobs for You's order: new first,
 * then newest posted.
 */
function listOrder<T extends Row>(rows: T[], reach: Reach): T[] {
  const cutoff = Date.now() - LIMITS.matches.max_age_days * DAY;
  return rows
    .filter((m) => (!m.posted_at || Date.parse(m.posted_at) >= cutoff) && m.open_state !== "closed" && fits({ ...m, visa: m.job?.visa }, reach))
    .map((m) => ({ m, key: { postedAt: m.posted_at, foundAt: m.created_at, percent: m.match_percent ?? 0, isNew: isNewMatch(m.checked_at, LIMITS.matches.new_days) } }))
    .sort((a, b) => newestFirst(a.key, b.key))
    .map(({ m }) => m);
}

type MatchRow = Row & { title: string; employer: string; url: string; credit: MatchView["credit"]; cv_version_id: string | null; source: MatchView["source"]; open_checked_at: string | null };

export type MatchView = { id: string; title: string; employer: string; location: string | null; remote: boolean; postedAt: string | null; url: string; credit: { text: string; link: string } | null; percent: number; jobId: string | null; tailored: boolean; isNew: boolean; source: "headcount" | "jobicy"; listedAt: string | null; sponsor: boolean };

/** Jobs that fit them and are waiting for a yes or no: new on the list first, then the most recently posted (D-210). */
export async function listMatches(viewer: Viewer): Promise<{ items: MatchView[]; searchedAt: string | null; tailorAhead: boolean; ready: boolean }> {
  if (viewer.preview) {
    const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
    return {
      ready: true,
      searchedAt: ago(0.2),
      tailorAhead: false,
      items: [
        { id: "m3", title: "Finance Operations Associate (Remote)", employer: "Sample Fintech", location: "Remote (EMEA)", remote: true, postedAt: ago(1), url: "https://jobicy.com/jobs/0-sample", credit: { text: "Listed on Jobicy", link: "https://jobicy.com/jobs/0-sample" }, percent: 90, jobId: "demo", tailored: false, isNew: true, source: "jobicy", listedAt: ago(0.2), sponsor: false },
        { id: "m1", title: "Graduate Trainee, Finance", employer: "Northbridge Bank", location: "Lagos, Nigeria", remote: false, postedAt: ago(3), url: "https://example.com/jobs/1", credit: null, percent: 94, jobId: "demo", tailored: false, isNew: false, source: "headcount", listedAt: ago(0.2), sponsor: false },
        { id: "m2", title: "Accounts Assistant", employer: "Lekki Foods Manufacturing", location: "Lagos, Nigeria", remote: false, postedAt: ago(9), url: "https://example.com/jobs/2", credit: null, percent: 91, jobId: "demo", tailored: true, isNew: false, source: "headcount", listedAt: null, sponsor: false },
        { id: "m4", title: "Junior Financial Analyst", employer: "Sample Capital", location: "London, England, GB", remote: false, postedAt: ago(4), url: "https://example.com/jobs/4", credit: null, percent: 88, jobId: "demo", tailored: false, isNew: false, source: "headcount", listedAt: ago(1), sponsor: true },
      ],
    };
  }
  const supabase = await createClient();
  const [{ data, error }, { data: me }] = await Promise.all([
    supabase.from("job_matches").select("*, job:jobs(visa:parsed->>visa_sponsorship)").eq("user_id", viewer.id).eq("status", "matched").order("checked_at", { ascending: false }).limit(100),
    supabase.from("users").select("*").eq("id", viewer.id).maybeSingle(),
  ]);
  const u = me as { matches_searched_at?: string | null; tailor_ahead?: boolean } | null;
  if (error) return { items: [], searchedAt: null, tailorAhead: false, ready: false };
  const reach = await reachFor(viewer, supabase);
  return {
    ready: true,
    searchedAt: u?.matches_searched_at ?? null,
    tailorAhead: Boolean(u?.tailor_ahead),
    items: listOrder((data ?? []) as MatchRow[], reach).map((m) => ({
      id: m.id,
      title: m.title,
      employer: m.employer,
      location: m.location,
      remote: m.remote,
      postedAt: m.posted_at,
      url: m.url,
      credit: m.credit,
      percent: m.match_percent ?? 0,
      jobId: m.job_id,
      tailored: Boolean(m.cv_version_id),
      isNew: isNewMatch(m.checked_at, LIMITS.matches.new_days),
      source: m.source,
      listedAt: m.open_state === "open" ? (m.open_checked_at ?? null) : null,
      sponsor: sponsored({ ...m, visa: m.job?.visa }, reach),
    })),
  };
}

/** The Tailor ahead setting (off until set, and before migration section 26). */
export async function tailorAheadOf(viewer: Viewer): Promise<boolean> {
  if (viewer.preview) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").eq("id", viewer.id).maybeSingle();
  return Boolean((data as { tailor_ahead?: boolean } | null)?.tailor_ahead);
}
