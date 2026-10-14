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

export type LegitimacySignal = { id: string; severity: Severity | "ok"; text: string; evidence: string | null; sourceUrl: string | null };
/** One line of "What we checked": passed, failed, or couldn't check (with why). */
export type LegitimacyCheck = { key: string; label: string; status: "pass" | "fail" | "unknown"; detail: string; sourceUrl: string | null };
export type LegitimacyView = { state: ScamState; headline: string; signals: LegitimacySignal[]; checks: LegitimacyCheck[]; cached: boolean; checkedAt: string };

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

function headlineFor(state: ScamState, signals: LegitimacySignal[], officialDomain: string | null): string {
  if (state === "red_flags") return signals.find((s) => s.severity === "red")?.text ?? "We found red flags in this post. Don't pay or share personal details.";
  if (state === "verified") return `Found on the official careers page${officialDomain ? ` at ${officialDomain}` : ""}. Even so, never pay to apply.`;
  return "We couldn't find this job on the company's official careers page. That doesn't prove it's fake. Check their official site before you send your details.";
}

/**
 * The checklist people asked for (D-112): does the company exist, how long has it been
 * around, is the email on its own website, did it post the job itself, any warnings.
 * Each line says when we couldn't check, and why.
 */
function checklist(findings: Finding[], job: ParsedJob | null, live: boolean): LegitimacyCheck[] {
  const f = (id: Finding["id"]) => findings.find((x) => x.id === id);
  const pending = live ? "Checking" : "We couldn't check this right now.";
  const named = Boolean(job?.employer_name);
  const hasRoute = Boolean(job && (job.how_to_apply.email || job.how_to_apply.url || job.contacts.emails.length));
  const line = (key: string, label: string, x: Finding | undefined, pass: Finding["result"][], fail: Finding["result"][], why: string): LegitimacyCheck => {
    if (!x || x.result === "unknown") return { key, label, status: "unknown", detail: x?.text ?? why, sourceUrl: x?.sourceUrl ?? null };
    return { key, label, status: pass.includes(x.result) ? "pass" : fail.includes(x.result) ? "fail" : "unknown", detail: x.text, sourceUrl: x.sourceUrl };
  };
  return [
    line("exists", "The company exists", f("L2-09"), ["found"], ["not_found"], named ? pending : "The post doesn't name the company, so we couldn't look it up."),
    line("age", "How long it has been around", f("L2-10"), ["found"], ["warning"], named ? (live ? pending : "We couldn't find when the company started.") : "No company named in the post."),
    line("domain", "Email and apply link are on the company's own website", f("L2-02"), ["match"], ["mismatch"], hasRoute ? (live ? pending : "We couldn't confirm the company's own website to compare.") : "The post gives no email or link to check."),
    line("posted", "The company posted this job itself", f("L2-01"), ["found"], ["not_found"], named ? (live ? pending : "We couldn't search the company's careers page or LinkedIn.") : "No company named in the post."),
    line("warnings", "No public warnings about this job", f("L2-05"), ["not_found"], ["warning"], live ? pending : "We couldn't search for warnings right now."),
    line("contacts", "Its phone numbers and emails aren't in scam reports", f("L2-06"), ["not_found"], ["warning"], live ? pending : "We couldn't search scam reports right now."),
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
  const official = findings.find((f) => f.id === "L2-01" && f.result === "found" && f.sourceType === "official");
  return { state, headline: headlineFor(state, signals, host(official?.sourceUrl) ?? null), signals, checks: checklist(findings, job, live), cached, checkedAt };
}

/** Layer 1 only: instant, free, offline friendly. Shown before the live lookup returns. */
export function quickCheck(text: string, job: ParsedJob): LegitimacyView {
  return view(layer1(text, job), [], false, new Date().toISOString(), job, true);
}

/**
 * The full check (Build pack section 9): Layer 1 rules, then the live lookup through
 * web search, RDAP and the registry. Cached 7 days per post (shared across users,
 * since job posts hold no personal data). The final state is computed in code.
 */
export async function fullCheck(
  supabase: SupabaseClient,
  ctx: { userId: string; jobId: string; postHash: string; text: string; job: ParsedJob },
): Promise<LegitimacyView> {
  const { userId, jobId, postHash, text, job } = ctx;
  const layer = layer1(text, job);
  const now = new Date();

  // 1. This user's cached check, then anyone's check of the same post.
  const { data: own } = await supabase.from("legitimacy_checks").select("lookup_findings, created_at, cached_until").eq("job_id", jobId).gt("cached_until", now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (own) return view(layer, own.lookup_findings as Finding[], true, own.created_at, job);
  if (isSupabaseConfigured() && !isPreviewMode() && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const admin = createAdminClient();
    const { data: same } = await admin.from("jobs").select("id").eq("post_hash", postHash).neq("id", jobId).limit(20);
    if (same?.length) {
      const { data: shared } = await admin.from("legitimacy_checks").select("lookup_findings, created_at").in("job_id", same.map((j) => j.id)).gt("cached_until", now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (shared) {
        await supabase.from("legitimacy_checks").insert({ job_id: jobId, user_id: userId, rule_flags: layer, lookup_findings: shared.lookup_findings, state: scamState(layer, shared.lookup_findings as Finding[]), cached_until: new Date(now.getTime() + 7 * 86_400_000).toISOString() });
        return view(layer, shared.lookup_findings as Finding[], true, shared.created_at, job);
      }
    }
  }

  // 2. Known domains: the post's claimed domain, or a government agency's official ones.
  const agency = matchAgency(job.employer_name);
  const officialDomains = [...(agency?.domains ?? []), ...(job.employer_domain_claimed ? [job.employer_domain_claimed.toLowerCase()] : [])];
  const routeHosts = [job.how_to_apply.email, job.how_to_apply.url, ...job.contacts.emails].map(host).filter((h): h is string => Boolean(h) && !freeEmail.domains.includes(h!));
  const findings: Finding[] = [];

  // L2-02 in code when we can decide it.
  if (officialDomains.length && routeHosts.length) {
    const allMatch = routeHosts.every((h) => officialDomains.some((d) => within(h, d)));
    findings.push(
      allMatch
        ? { id: "L2-02", result: "match", text: "The contact and apply addresses match the employer's own website.", sourceUrl: null, sourceType: null }
        : { id: "L2-02", result: "mismatch", text: "The contact or apply address isn't on the employer's own website. Check it on their official site.", sourceUrl: null, sourceType: null },
    );
  }

  // L2-04 domain age, L2-03 registry.
  const domain = job.employer_domain_claimed ?? routeHosts[0] ?? null;
  const [age, cac] = await Promise.all([domain ? domainAgeDays(domain) : Promise.resolve(null), cacLookup(job.employer_name ?? "")]);
  if (age !== null && age < 90) findings.push({ id: "L2-04", result: "warning", text: `The website ${domain} was registered only ${age} days ago.`, sourceUrl: null, sourceType: "registry" });
  if (cac) findings.push(cac);

  // L2-01, 05, 06, 07, 08 through web search, then structured with cited sources only.
  if (job.employer_name || routeHosts.length) {
    const brief = [
      `Employer: ${job.employer_name ?? "not named"}`,
      `Job title: ${job.title ?? "not stated"}`,
      job.employer_domain_claimed ? `Domain the post claims: ${job.employer_domain_claimed}` : null,
      job.how_to_apply.email ? `Apply by email to: ${job.how_to_apply.email}` : null,
      job.how_to_apply.url ? `Apply link: ${job.how_to_apply.url}` : null,
      job.contacts.phones.length ? `Phone numbers in the post: ${job.contacts.phones.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const research = await runResearch({ name: "legitimacy_search", model: "claude-sonnet-5-5", user: brief, maxSearches: LIMITS.legitimacy.max_searches, userId, promptVersion: "v2" });
    if (research.ok) {
      const structured = await runTask(
        "legitimacy_lookup",
        { employer: job.employer_name ?? "not named", title: job.title ?? "not stated", sources: research.sources, notes: research.notes },
        { userId },
      );
      if (structured.ok) {
        // The company's own website, as the search found it, decides the domain check when the post didn't claim one.
        const c = structured.data.company;
        const foundDomain = c.official_domain?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null;
        if (foundDomain && !officialDomains.length) officialDomains.push(foundDomain);
        const allRoutes = [job.how_to_apply.email, job.how_to_apply.url, ...job.contacts.emails].map(host).filter((h): h is string => Boolean(h));
        if (foundDomain && allRoutes.length && !findings.some((x) => x.id === "L2-02")) {
          const free = allRoutes.find((h) => freeEmail.domains.includes(h));
          const ok = allRoutes.every((h) => within(h, foundDomain));
          findings.push(
            ok
              ? { id: "L2-02", result: "match", text: `The email and apply link are on the company's own website, ${foundDomain}.`, sourceUrl: null, sourceType: null }
              : { id: "L2-02", result: "mismatch", text: free ? `The post uses a ${free} address, not an address at ${foundDomain}. Real employers usually use their own.` : `The contact or apply address isn't on ${foundDomain}, the company's own website.`, sourceUrl: null, sourceType: null },
          );
        }
        if (c.founded_year) {
          const years = new Date().getFullYear() - c.founded_year;
          const src = c.founded_source_index ? research.sources[c.founded_source_index - 1] : undefined;
          findings.push({
            id: "L2-10",
            result: years < 1 ? "warning" : "found",
            text: years < 1 ? `The company started in ${c.founded_year}, less than a year ago.` : `Around since ${c.founded_year}, about ${years} ${years === 1 ? "year" : "years"}.`,
            sourceUrl: src?.url ?? null,
            sourceType: null,
          });
        }
        const nameToken = (job.employer_name ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).find((w) => w.length >= 4);
        for (const f of structured.data.findings) {
          if (f.id === "L2-02" && findings.some((x) => x.id === "L2-02")) continue; // code already decided
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
    }
  }

  const state = scamState(layer, findings);
  await supabase.from("legitimacy_checks").insert({
    job_id: jobId,
    user_id: userId,
    rule_flags: layer,
    lookup_findings: findings,
    state: state === "red_flags" ? "red_flags" : state,
    cached_until: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
  });
  const all = [...layer.map((s) => s.severity), ...findings.map(findingSeverity)];
  await track("legitimacy_checked", { state, red_count: all.filter((s) => s === "red").length, amber_count: all.filter((s) => s === "amber").length, cached: false }, userId);
  return view(layer, findings, false, now.toISOString(), job);
}
