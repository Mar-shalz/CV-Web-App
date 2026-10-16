import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runTask } from "@/lib/ai";
import { runResearch } from "@/lib/ai/research";
import { layer1, matchAgency, type Severity, type Signal } from "@/lib/rules/scam/layer1";
import { findingSeverity, scamState, type Finding, type ScamState } from "@/lib/rules/scam/state";
import type { ParsedJob } from "@/lib/jobs/schema";
import freeEmail from "@/config/lists/free_email_domains.json";
import { LIMITS } from "@/lib/config";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { track } from "@/lib/analytics/server";
import { companyRecord, hiringBoard, isAtsHost, domainOf, normaliseName } from "./company";
import { searchResearch, searchFounded } from "./search-research";
import { boardListing, boardOf, careersHit } from "./evidence";
import { searchProvider } from "@/lib/search";
import sources from "@/config/lists/job_sources.json";

export type LegitimacySignal = { id: string; severity: Severity | "ok"; text: string; evidence: string | null; sourceUrl: string | null };
/** One line of "What we checked": passed, failed, or couldn't check (with why). `word` replaces "Couldn't check" when we did check and found nothing. */
export type LegitimacyCheck = { key: string; label: string; status: "pass" | "warn" | "fail" | "unknown"; detail: string; sourceUrl: string | null; word?: string };
/**
 * `calm`: couldn't fully confirm, but the company is real and nothing looks wrong (D-156).
 * Shown as "No warning signs found" instead of "Be careful", so a real job posted only on
 * LinkedIn or Indeed doesn't put people off. Never "safe".
 */
/**
 * `mostly`: couldn't fully confirm, no red flag, and most checks passed (D-173). Shown as
 * "Mostly checks out: 1 thing to look at" instead of "We couldn't confirm it".
 */
export type LegitimacyView = { state: ScamState; headline: string; signals: LegitimacySignal[]; checks: LegitimacyCheck[]; cached: boolean; checkedAt: string; retry?: boolean; calm?: boolean; mostly?: { passed: number; total: number; toLook: number } };

const NEWS = ["punchng.com", "premiumtimesng.com", "guardian.ng", "vanguardngr.com", "thecable.ng", "channelstv.com", "businessday.ng", "dailytrust.com", "saharareporters.com", "tribuneonlineng.com", "thisdaylive.com", "leadership.ng", "nairametrics.com", "techcabal.com", "arise.tv"];
const FORUMS = ["nairaland.com", "reddit.com", "quora.com"];

const host = (v: string | null | undefined) => {
  if (!v) return null;
  const at = v.lastIndexOf("@");
  if (at >= 0) return v.slice(at + 1).toLowerCase();
  try {
    return new URL(v.startsWith("http") ? v : `https://${v}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};
const within = (h: string, domain: string) => h === domain || h.endsWith(`.${domain}`);

/** Domain age from RDAP (L2-04). Null when the registry doesn't answer. */
async function domainAgeDays(domain: string): Promise<number | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { signal: AbortSignal.timeout(5000), headers: { accept: "application/rdap+json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
    const reg = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
    return reg ? Math.floor((Date.now() - new Date(reg).getTime()) / 86_400_000) : null;
  } catch {
    return null;
  }
}

/**
 * Company registry lookup (L2-03). CAC public search or a KYB vendor goes behind this
 * interface. Supporting evidence only, never "verified" on its own. Not configured yet.
 */
async function cacLookup(name: string): Promise<Finding | null> {
  if (!process.env.CAC_PROVIDER || !name) return null;
  return null;
}

function headlineFor(state: ScamState, signals: LegitimacySignal[], findings: Finding[], retry: boolean, employer: string | null): string {
  const official = findings.find((f) => f.id === "L2-01" && f.result === "found" && f.sourceType === "official");
  if (state === "red_flags") return signals.find((s) => s.severity === "red")?.text ?? "We found red flags in this post. Don't pay or share personal details.";
  if (state === "verified" && official) return `${official.text.replace(/^Yes\. /, "")} Even so, never pay to apply.`;
  if (state === "verified") {
    const listing = findings.find((f) => f.id === "L2-01" && f.result === "found");
    const board = listing?.sourceUrl ? boardOf(listing.sourceUrl) : null;
    return `${employer ?? "The company"} is a real company, this job is listed under its name${board ? ` on ${board}` : ""}, and you apply through the company's own website or email. Even so, never pay to apply.`;
  }
  if (retry) return "Web search wasn't available just now, so some checks couldn't run. The ones we could run are below. Try again in a few minutes.";
  // Couldn't fully confirm. Most real jobs land here (many companies post only on job
  // sites), so say what we did find and what to do, without putting people off (D-156).
  if (signals.some((s) => s.severity === "amber")) return "Some things need a closer look. Read what we found below before you send your details, and never pay to apply.";
  const name = employer ?? "The company";
  const exists = findings.some((f) => f.id === "L2-09" && f.result === "found");
  const listed = findings.find((f) => f.id === "L2-01" && f.result === "found");
  if (exists && official) return `${name} is a real company, and this job is on its own website. Apply there, and never pay to apply.`;
  if (exists && listed) return `${name} is a real company, and this job is listed under its name${listed.sourceUrl && boardOf(listed.sourceUrl) ? ` on ${boardOf(listed.sourceUrl)}` : ""}. Many companies post jobs only on job sites, so it's normal not to see it on their website. Never pay to apply.`;
  if (exists) return `${name} is a real company. We couldn't link this exact job to them, which is common when jobs are shared on other sites. Apply through the company's official contacts, and never pay to apply.`;
  return "We couldn't confirm who posted this job. That doesn't mean it's fake. See what we checked below, and never pay or share your bank details to apply.";
}


const BOARDS = sources.job_boards as Record<string, string>;
const SOCIAL = sources.social as Record<string, string>;
const inList = (h: string, list: Record<string, string> | string[]) => (Array.isArray(list) ? list : Object.keys(list)).find((d) => within(h, d)) ?? null;

/** The part of a host that is registered: careers.acme.com.ng is acme.com.ng. */
export function registrable(h: string): string {
  const parts = h.split(".");
  const second = parts.at(-2) ?? "";
  const keepThree = parts.length >= 3 && (["com", "org", "gov", "edu", "net", "co", "ac", "sch", "mil"].includes(second) || second.length <= 2);
  return parts.slice(keepThree ? -3 : -2).join(".");
}

/** Where the job was posted, and what that says about it (D-152). */
async function sourceFinding(sourceUrl: string | null, employer: string | null, officialDomains: string[], ownBoard: ReturnType<typeof hiringBoard>): Promise<Finding> {
  const f = (result: Finding["result"], text: string, sourceType: Finding["sourceType"] = null): Finding => ({ id: "L2-11", result, text, sourceUrl, sourceType });
  const h = host(sourceUrl);
  if (!h) return { id: "L2-11", result: "unknown", text: "You pasted the job's text, so we can't see where it was posted. Add its link for a fuller check.", sourceUrl: null, sourceType: null };
  if (officialDomains.some((d) => within(h, d))) return f("found", `On the company's own website, ${h}.`, "official");
  if (ownBoard) return f("found", `On ${employer ?? "the company"}'s own ${ownBoard.service} hiring page.`, "official");
  const shortener = inList(h, sources.shorteners);
  if (shortener) return f("warning", `The link is shortened (${shortener}), which hides where it really goes. Find the job on the company's website or a known job site.`);
  const social = inList(h, SOCIAL);
  if (social) return f("warning", `Posted on ${SOCIAL[social]}, where anyone can post a job. Look for the same job on the company's website or its LinkedIn page before you apply.`);
  const freeHost = inList(h, sources.free_hosts);
  if (freeHost) return f("warning", `Posted on a free website service (${freeHost}), not a company website. Real employers usually post on their own site or a known job board.`);
  const token = normaliseName(employer ?? "")
    .split(" ")
    .find((w) => w.length >= 4);
  if (token && h.includes(token) && !officialDomains.some((d) => within(h, d))) {
    return f("warning", `${h} uses the company's name, but it isn't the company's own website${officialDomains[0] ? ` (${officialDomains[0]})` : ""}. Fake job sites often do this.`);
  }
  const board = inList(h, BOARDS);
  if (board) return f("found", `On ${BOARDS[board]}, a well-known job site where many companies post their jobs. Job sites don't check every advert, so never pay to apply.`);
  const days = await domainAgeDays(registrable(h));
  if (days !== null && days < 180) return f("warning", `Posted on ${h}, a website set up only ${days} days ago.`);
  return f("unknown", `Posted on ${h}. We couldn't tell if that site belongs to the company or is a known job site.`);
}

/**
 * The checklist people asked for (D-112): does the company exist, how long has it been
 * around, is the email on its own website, did it post the job itself, any warnings.
 * Each line says when we couldn't check, and why.
 */
/** Not finding the job on the company's site is common, so it's "Not found" in grey, never a fail (D-156). */
function posted(c: LegitimacyCheck, x: Finding | undefined, employer: string | null): LegitimacyCheck {
  return x?.result === "not_found" ? { ...c, status: "unknown", word: "Not found", detail: x.text.startsWith("It isn't") ? x.text : notListed(employer, false) } : c;
}
const notListed = (employer: string | null, searchedBoards: boolean) =>
  `It isn't on ${employer ? `${employer}'s` : "the company's"} own website${searchedBoards ? ", and we didn't find it on LinkedIn, Indeed or Jobberman" : ""}. Many companies share jobs in other places too, so this isn't a warning on its own.`;

function checklist(findings: Finding[], job: ParsedJob | null, live: boolean): LegitimacyCheck[] {
  const f = (id: Finding["id"]) => findings.find((x) => x.id === id);
  const pending = live ? "Checking" : "We couldn't check this right now.";
  const named = Boolean(job?.employer_name);
  const hasRoute = Boolean(job && (job.how_to_apply.email || job.how_to_apply.url || job.contacts.emails.length));
  // Graded like the verdict (D-169): a red sign is "No", an amber one "Check this".
  const line = (key: string, label: string, x: Finding | undefined, pass: Finding["result"][], fail: Finding["result"][], why: string): LegitimacyCheck => {
    if (!x || x.result === "unknown") return { key, label, status: "unknown", detail: x?.text ?? why, sourceUrl: x?.sourceUrl ?? null };
    const failed = fail.includes(x.result);
    return { key, label, status: pass.includes(x.result) ? "pass" : failed ? (findingSeverity(x) === "red" ? "fail" : "warn") : "unknown", detail: x.text, sourceUrl: x.sourceUrl };
  };
  // Every finding that can raise a warning has its own line, so the verdict never rests on
  // something the list doesn't show (founder round 21).
  const extra = (
    [
      ["L2-04", "website_age", "Its website isn't brand new", [] as Finding["result"][], ["warning"] as Finding["result"][]],
      ["L2-07", "footprint", "It has a real presence online", ["found"], ["warning"]],
      ["L2-08", "forums", "No scam reports about it on forums", ["not_found"], ["warning"]],
      ["L2-03", "registry", "It's in the company register", ["found", "match"], ["not_found", "warning"]],
    ] as const
  ).flatMap(([id, key, label, pass, fail]) => {
    const x = f(id);
    return x ? [line(key, label, x, [...pass], [...fail], "")] : [];
  });
  return [
    line("exists", "The company exists", f("L2-09"), ["found"], ["not_found"], named ? pending : "The post doesn't name the company, so we couldn't look it up."),
    line("age", "How long it has been around", f("L2-10"), ["found"], ["warning"], named ? (live ? pending : "We couldn't find when the company started.") : "No company named in the post."),
    line("domain", "Email and apply link are on the company's own website", f("L2-02"), ["match"], ["mismatch"], hasRoute ? (live ? pending : "We couldn't confirm the company's own website to compare.") : "The post gives no email or link to check."),
    posted(line("posted", "Listed under the company's name", f("L2-01"), ["found"], [], named ? (live ? pending : "We couldn't search the company's careers page or job sites.") : "No company named in the post."), f("L2-01"), job?.employer_name ?? null),
    line("source", "Where the job was posted", f("L2-11"), ["found"], ["warning"], live ? pending : "We couldn't see where the job was posted."),
    line("warnings", "No public warnings about this job", f("L2-05"), ["not_found"], ["warning"], live ? pending : "We couldn't search for warnings right now."),
    line("contacts", "Its phone numbers and emails aren't in scam reports", f("L2-06"), ["not_found"], ["warning"], live ? pending : "We couldn't search scam reports right now."),
    ...extra,
  ];
}

function view(layer: Signal[], findings: Finding[], cached: boolean, checkedAt: string, job: ParsedJob | null = null, live = false): LegitimacyView {
  const state = scamState(layer, findings);
  const order: Record<string, number> = { red: 0, amber: 1, info: 2, ok: 3 };
  const signals: LegitimacySignal[] = [
    ...layer.map((s) => ({ ...s, sourceUrl: null })),
    ...findings.map((f) => {
      const sev = findingSeverity(f);
      return { id: f.id, severity: (sev ?? (f.result === "found" || f.result === "match" ? "ok" : "info")) as LegitimacySignal["severity"], text: f.text, evidence: null, sourceUrl: f.sourceUrl };
    }),
  ].sort((a, b) => order[a.severity]! - order[b.severity]!);
  const retry = findings.some((f) => f.note === "search_unavailable");
  const calm = state === "unverified" && !retry && !signals.some((s) => s.severity === "amber" || s.severity === "red") && findings.some((f) => f.id === "L2-09" && f.result === "found");
  const checks = checklist(findings, job, live);
  // Most checks passed and nothing is red: say so, and point at what to look at (D-173).
  const passed = checks.filter((c) => c.status === "pass").length;
  const toLook = checks.filter((c) => c.status === "warn").length + layer.filter((s) => s.severity === "amber").length;
  const mostly = state === "unverified" && !retry && !live && !calm && toLook > 0 && checks.length > 0 && passed / checks.length >= 0.7 ? { passed, total: checks.length, toLook } : undefined;
  const headline = mostly
    ? `${passed} of ${mostly.total} checks passed. Look at ${toLook === 1 ? "the one" : `the ${toLook}`} marked “Check this” before you send your details, and never pay to apply.`
    : headlineFor(state, signals, findings, retry, job?.employer_name?.trim() || null);
  return { state, headline, signals, checks, cached, checkedAt, retry, calm, mostly };
}

/**
 * The saved check for this job while it's fresh, so a screen can show it at once without
 * asking again (D-161). Null when there isn't one, it's from before D-118, or search was down.
 */
export async function savedCheck(supabase: SupabaseClient, jobId: string, text: string, job: ParsedJob): Promise<LegitimacyView | null> {
  const { data } = await supabase.from("legitimacy_checks").select("lookup_findings, created_at").eq("job_id", jobId).gt("cached_until", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const found = data?.lookup_findings as Finding[] | undefined;
  if (!data || !found || !current(found) || searchDown(found)) return null;
  return view(layer1(text, job), found, true, data.created_at, job);
}

/** Layer 1 only: instant, free, offline friendly. Shown before the live lookup returns. */
export function quickCheck(text: string, job: ParsedJob): LegitimacyView {
  return view(layer1(text, job), [], false, new Date().toISOString(), job, true);
}

/** A cached check from before D-118 has no "company exists" line; it is run again. */
const current = (findings: Finding[]) => findings.some((f) => f.id === "L2-09");
const searchDown = (findings: Finding[]) => findings.some((f) => f.note === "search_unavailable");
const NO_SEARCH = "Web search wasn't available just now, so we couldn't look. Try again in a few minutes.";
/** Job sites where anyone can post under a company's name; neither proof nor a warning. */
const JOB_SITES = /(^|\.)(linkedin\.com|indeed\.com|jobberman\.com|myjobmag\.com|hotnigerianjobs\.com|ngcareers\.com|glassdoor\.com)$/i;

/**
 * The full check (Build pack section 9): Layer 1 rules, then the live lookup. The
 * company record (Wikidata), its own hiring board, RDAP and the domain match run in
 * code and need no search (D-118); web search adds warnings and scam reports. A check
 * whose search failed is kept 15 minutes, not 7 days, so "Check again" works. Cached
 * per post and shared across users, since job posts hold no personal data. The final
 * state is computed in code.
 */
export async function fullCheck(
  supabase: SupabaseClient,
  ctx: { userId: string; jobId: string; postHash: string; text: string; job: ParsedJob; sourceUrl?: string | null; fresh?: boolean },
): Promise<LegitimacyView> {
  const { userId, jobId, postHash, text, job, sourceUrl = null, fresh = false } = ctx;
  const layer = layer1(text, job);
  const now = new Date();

  // 1. This user's cached check, then anyone's complete check of the same post.
  if (!fresh) {
    const { data: own } = await supabase.from("legitimacy_checks").select("lookup_findings, created_at, cached_until").eq("job_id", jobId).gt("cached_until", now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (own && current(own.lookup_findings as Finding[])) return view(layer, own.lookup_findings as Finding[], true, own.created_at, job);
    if (isSupabaseConfigured() && !isPreviewMode() && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      const admin = createAdminClient();
      const { data: same } = await admin.from("jobs").select("id").eq("post_hash", postHash).neq("id", jobId).limit(20);
      if (same?.length) {
        const { data: shared } = await admin.from("legitimacy_checks").select("lookup_findings, created_at").in("job_id", same.map((j) => j.id)).gt("cached_until", now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const found = shared?.lookup_findings as Finding[] | undefined;
        if (shared && found && current(found) && !searchDown(found)) {
          await supabase.from("legitimacy_checks").insert({ job_id: jobId, user_id: userId, rule_flags: layer, lookup_findings: found, state: scamState(layer, found), cached_until: new Date(now.getTime() + 7 * 86_400_000).toISOString() });
          return view(layer, found, true, shared.created_at, job);
        }
      }
    }
  }

  const employer = job.employer_name?.trim() || null;
  const agency = matchAgency(employer);
  const routes = [job.how_to_apply.email, job.how_to_apply.url, ...job.contacts.emails].filter((v): v is string => Boolean(v));
  const findings: Finding[] = [];

  // 2. In parallel: the company record, and the web search (the slow part).
  const brief = [
    `Employer: ${employer ?? "not named"}`,
    `Job title: ${job.title ?? "not stated"}`,
    job.employer_domain_claimed ? `Domain the post claims: ${job.employer_domain_claimed}` : null,
    job.how_to_apply.email ? `Apply by email to: ${job.how_to_apply.email}` : null,
    job.how_to_apply.url ? `Apply link: ${job.how_to_apply.url}` : null,
    sourceUrl ? `Where the person found the post: ${sourceUrl}` : null,
    job.contacts.phones.length ? `Phone numbers in the post: ${job.contacts.phones.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const [record, searched_, cac] = await Promise.all([
    agency ? Promise.resolve(null) : companyRecord(employer),
    // Our own web search when one is set up (D-152), otherwise Gemini's Google Search.
    !(employer || routes.length)
      ? Promise.resolve(null)
      : searchProvider()
        ? searchResearch({ employer, title: job.title, emails: [job.how_to_apply.email, ...job.contacts.emails].filter((v): v is string => Boolean(v)), phones: job.contacts.phones })
        : runResearch({ name: "legitimacy_search", model: "claude-sonnet-5-5", user: brief, maxSearches: LIMITS.legitimacy.max_searches, userId, promptVersion: "v2" }).then((research) => ({ research, hits: null })),
    cacLookup(employer ?? ""),
  ]);
  const research = searched_?.research ?? null;
  const hits = searched_?.hits ?? null;
  // The AI reads the sources while, if the company record has no start year, the search looks for one (D-156).
  const [structured, foundedHit] = await Promise.all([
    research?.ok ? runTask("legitimacy_lookup", { employer: employer ?? "not named", title: job.title ?? "not stated", sources: research.sources, notes: research.notes }, { userId }) : Promise.resolve(null),
    employer && !agency && !record?.founded && searchProvider() ? searchFounded(employer, hits?.all ?? []) : Promise.resolve(null),
  ]);
  const company = structured?.ok ? structured.data.company : null;
  const searched = Boolean(structured?.ok);
  if (cac) findings.push(cac);

  // 3. The company's own website: a government body's known domains, the company record, what the search found, then what the post claims.
  const searchDomain = company?.official_domain ? domainOf(company.official_domain) : null;
  const officialDomains = [...new Set([...(agency?.domains ?? []), record?.domain, searchDomain, job.employer_domain_claimed?.toLowerCase()].filter((d): d is string => Boolean(d)))];
  const mainDomain = officialDomains[0] ?? null;

  // L2-09 Does the company exist?
  if (agency) findings.push({ id: "L2-09", result: "found", text: `Yes. ${agency.name ?? employer} is a government body.`, sourceUrl: agency.domains?.[0] ? `https://${agency.domains[0]}` : null, sourceType: "official" });
  else if (record) findings.push({ id: "L2-09", result: "found", text: `Yes. ${record.description && record.description.length > 60 ? record.description : `${record.label}${record.description ? `, ${record.description}` : ""}`}.${record.domain ? ` Official website: ${record.domain}.` : ""}`, sourceUrl: record.sourceUrl, sourceType: "registry" });
  else if (company?.exists === "yes") findings.push({ id: "L2-09", result: "found", text: `Yes. We found ${employer} online${searchDomain ? `, with its own website at ${searchDomain}` : ""}.`, sourceUrl: searchDomain ? `https://${searchDomain}` : null, sourceType: null });
  else if (company?.exists === "no") findings.push({ id: "L2-09", result: "not_found", text: `We found no trace of a company called ${employer} online. Be careful.`, sourceUrl: null, sourceType: null });
  else if (!employer) findings.push({ id: "L2-09", result: "unknown", text: "The post doesn't name the company, so we couldn't look it up.", sourceUrl: null, sourceType: null });
  else if (searched) findings.push({ id: "L2-09", result: "unknown", text: `We couldn't find a public record of ${employer}. Small and new firms often have none, so check their website or office yourself.`, sourceUrl: null, sourceType: null });
  else findings.push({ id: "L2-09", result: "unknown", text: `${employer} isn't in the open company records we check, and ${NO_SEARCH.charAt(0).toLowerCase()}${NO_SEARCH.slice(1)}`, sourceUrl: null, sourceType: null, note: "search_unavailable" });

  // L2-10 How long has it been around? The company record, then a page that says when it
  // started (found by our search), then what the AI read, then the age of its website.
  const founded = record?.founded ?? foundedHit?.year ?? company?.founded_year ?? null;
  if (founded) {
    const years = now.getFullYear() - founded;
    const src = record?.founded ? record.sourceUrl : foundedHit ? foundedHit.url : company?.founded_source_index && research?.ok ? research.sources[company.founded_source_index - 1]?.url : undefined;
    findings.push({ id: "L2-10", result: years < 1 ? "warning" : "found", text: years < 1 ? `It started in ${founded}, less than a year ago.` : `Since ${founded}, about ${years} ${years === 1 ? "year" : "years"}.`, sourceUrl: src ?? null, sourceType: record?.founded ? "registry" : null });
  }
  const ageDomain = mainDomain ?? job.employer_domain_claimed ?? null;
  const days = ageDomain ? await domainAgeDays(ageDomain) : null;
  if (!founded && days !== null && ageDomain) {
    const year = new Date(now.getTime() - days * 86_400_000).getFullYear();
    const years = Math.floor(days / 365);
    findings.push({ id: "L2-10", result: days < 365 ? "warning" : "found", text: days < 365 ? `Its website ${ageDomain} was set up less than a year ago.` : `Its website ${ageDomain} has existed since ${year}, about ${years} ${years === 1 ? "year" : "years"}. That's the best guide we found to the company's age.`, sourceUrl: null, sourceType: "registry" });
  }
  if (days !== null && days < 90 && ageDomain) findings.push({ id: "L2-04", result: "warning", text: `The website ${ageDomain} was registered only ${days} days ago.`, sourceUrl: null, sourceType: "registry" });

  // L2-02 Are the email and apply link on the company's own website? A link to the company's own
  // board on a hiring service counts as theirs; general job sites are left out of the comparison.
  const boards = [sourceUrl, job.how_to_apply.url].map((u) => hiringBoard(u, employer)).filter((b): b is NonNullable<typeof b> => Boolean(b));
  const ownBoard = boards.find((b) => b.matchesEmployer) ?? null;
  const toCompare = routes.map(host).filter((h): h is string => Boolean(h) && !JOB_SITES.test(h!) && !(ownBoard && isAtsHost(h!)));
  if (toCompare.length && mainDomain) {
    const free = toCompare.find((h) => freeEmail.domains.includes(h));
    const ok = toCompare.every((h) => officialDomains.some((d) => within(h, d)));
    findings.push(
      ok
        ? { id: "L2-02", result: "match", text: `Yes. They're on ${mainDomain}, the company's own website${ownBoard ? `, or its own ${ownBoard.service} hiring page` : ""}.`, sourceUrl: null, sourceType: null }
        : { id: "L2-02", result: "mismatch", text: free ? `The post uses a ${free} address, not one at ${mainDomain}. Real employers usually use their own.` : `The contact or apply address isn't on ${mainDomain}, the company's own website. Check it on their official site.`, sourceUrl: null, sourceType: null },
    );
  } else if (!toCompare.length && ownBoard) {
    findings.push({ id: "L2-02", result: "match", text: `Yes. You apply on the company's own ${ownBoard.service} hiring page.`, sourceUrl: job.how_to_apply.url ?? sourceUrl, sourceType: null });
  } else if (toCompare.length) {
    const free = toCompare.find((h) => freeEmail.domains.includes(h));
    findings.push({ id: "L2-02", result: "unknown", text: free ? `The post uses a ${free} address. We couldn't confirm the company's own website to compare, so ask for an official address.` : "We couldn't confirm the company's own website to compare.", sourceUrl: null, sourceType: null });
  }

  // L2-01 Did the company post it? Its own website or hiring board decides it in code.
  const onOwnSite = [sourceUrl, job.how_to_apply.url].map(host).find((h) => h && officialDomains.some((d) => within(h, d)));
  if (onOwnSite) findings.push({ id: "L2-01", result: "found", text: `Yes. It's on the company's own website, ${onOwnSite}.`, sourceUrl: sourceUrl ?? job.how_to_apply.url, sourceType: "official" });
  else if (ownBoard) findings.push({ id: "L2-01", result: "found", text: `Yes. It's on ${employer}'s own ${ownBoard.service} hiring page, which only the company can post to.`, sourceUrl: sourceUrl && hiringBoard(sourceUrl, employer) ? sourceUrl : job.how_to_apply.url, sourceType: "official" });
  else if (hits && job.title) {
    // The search found the job on the company's own careers page or hiring board.
    const own = careersHit([...hits.careers, ...hits.site], job.title, (u) => {
      const h = host(u);
      return Boolean(h && (officialDomains.some((d) => within(h, d)) || hiringBoard(u, employer)?.matchesEmployer));
    });
    if (own) findings.push({ id: "L2-01", result: "found", text: `Yes. A matching job is on the company's own careers page, ${host(own.url)}.`, sourceUrl: own.url, sourceType: "official" });
  }

  // L2-11 Where was the job posted? The company's own site or hiring page, a well-known job
  // site, or somewhere anyone can post, a hidden link, a free website or a brand new site.
  findings.push(await sourceFinding(sourceUrl, employer, officialDomains, ownBoard));

  // 4. The search's findings, for anything code hasn't decided.
  const nameToken = (employer ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).find((w) => w.length >= 4);
  if (structured?.ok && research?.ok) {
    for (const f of structured.data.findings) {
      if (findings.some((x) => x.id === f.id)) continue; // code already decided it
      const src = f.source_index ? research.sources[f.source_index - 1] : undefined;
      const h = host(src?.url);
      const sourceType: Finding["sourceType"] = !h
        ? null
        : FORUMS.some((d) => within(h, d))
          ? "forum"
          : NEWS.some((d) => within(h, d))
            ? "news"
            : h.endsWith("cac.gov.ng")
              ? "registry"
              : officialDomains.some((d) => within(h, d)) || (!officialDomains.length && Boolean(nameToken && h.includes(nameToken)))
                ? "official"
                : null;
      findings.push({ id: f.id, result: f.result, text: f.text, sourceUrl: src?.url ?? null, sourceType });
    }
  }
  // Not on the company's own site? Many companies post only on job sites (D-156): a listing
  // under the company's name on LinkedIn, Indeed or Jobberman (where they found it, or in
  // the search) counts as listed. Not finding it anywhere is said plainly, never as a warning.
  const decided = findings.findIndex((f) => f.id === "L2-01");
  if (decided < 0 || findings[decided]!.result !== "found") {
    const fromSource = employer && sourceUrl && boardOf(sourceUrl) && !isAtsHost(host(sourceUrl) ?? "") ? { board: boardOf(sourceUrl)!, url: sourceUrl } : null;
    const listing = fromSource ?? (hits && employer && job.title ? boardListing([...hits.boards, ...hits.careers], employer, job.title) : null);
    const next: Finding = listing
      ? { id: "L2-01", result: "found", text: `Yes. ${fromSource ? "It's" : "A matching job is"} on ${listing.board} under ${employer}'s name. Many companies post jobs only on job sites, so that's normal.`, sourceUrl: listing.url, sourceType: null }
      : searched || decided >= 0
        ? { id: "L2-01", result: "not_found", text: notListed(employer, Boolean(hits)), sourceUrl: null, sourceType: null }
        : { id: "L2-01", result: "unknown", text: `We couldn't search the company's careers page or job sites. ${NO_SEARCH.split(", so ")[0]}.`, sourceUrl: null, sourceType: null, note: "search_unavailable" };
    if (decided >= 0 && (listing || findings[decided]!.result === "not_found")) findings[decided] = next;
    else if (decided < 0) findings.push(next);
  }
  if (!searched) {
    for (const id of ["L2-05", "L2-06"] as const) if (!findings.some((f) => f.id === id)) findings.push({ id, result: "unknown", text: NO_SEARCH, sourceUrl: null, sourceType: null, note: "search_unavailable" });
  }

  const state = scamState(layer, findings);
  const down = searchDown(findings);
  await supabase.from("legitimacy_checks").insert({
    job_id: jobId,
    user_id: userId,
    rule_flags: layer,
    lookup_findings: findings,
    state: state === "red_flags" ? "red_flags" : state,
    cached_until: new Date(now.getTime() + (down ? 15 * 60_000 : 7 * 86_400_000)).toISOString(),
  });
  const all = [...layer.map((s) => s.severity), ...findings.map(findingSeverity)];
  await track("legitimacy_checked", { state, red_count: all.filter((s) => s === "red").length, amber_count: all.filter((s) => s === "amber").length, cached: false }, userId);
  return view(layer, findings, false, now.toISOString(), job);
}
