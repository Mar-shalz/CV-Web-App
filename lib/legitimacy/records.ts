import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { LIMITS } from "@/lib/config";
import { normaliseName, type CompanyRecord } from "./company";

// Our own company records (founder round 33, D-200). Every job check adds what it learned
// about the employer: its official website, whether it exists, when it started and its
// open record. The next check of any post from that employer starts from here, for
// everyone, and only looks again once the facts are older than config
// limits.legitimacy.cache_days_employer. Facts only: these records never call a company a
// scam (scammers use real names), and how many posts named it with red flags is for the
// back office alone. Server only.

export type CompanyFacts = {
  name: string;
  officialDomain: string | null;
  exists: "yes" | "no" | "unknown";
  description: string | null;
  foundedYear: number | null;
  foundedSource: string | null;
  recordLabel: string | null;
  recordSource: string | null;
  checkedAt: string;
};

const enabled = () => isSupabaseConfigured() && !isPreviewMode() && Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

type Row = {
  normalised_name: string;
  name: string;
  official_domain: string | null;
  exists_state: CompanyFacts["exists"];
  description: string | null;
  founded_year: number | null;
  founded_source: string | null;
  record_label: string | null;
  record_source: string | null;
  checked_at: string;
  checks: number;
  posts_with_red_flags: number;
};

/** What we already know about this employer, while it's fresh; null to look it up. */
export async function knownCompany(employer: string | null): Promise<CompanyFacts | null> {
  const key = normaliseName(employer ?? "").slice(0, 160);
  if (!key || !enabled()) return null;
  try {
    const since = new Date(Date.now() - LIMITS.legitimacy.cache_days_employer * 86_400_000).toISOString();
    const { data } = await createAdminClient().from("company_records").select("*").eq("normalised_name", key).gt("checked_at", since).maybeSingle();
    const r = data as Row | null;
    return r
      ? { name: r.name, officialDomain: r.official_domain, exists: r.exists_state, description: r.description, foundedYear: r.founded_year, foundedSource: r.founded_source, recordLabel: r.record_label, recordSource: r.record_source, checkedAt: r.checked_at }
      : null;
  } catch {
    return null;
  }
}

/** The open record (Wikidata) we saved, in the shape a fresh lookup returns. */
export function recordFrom(k: CompanyFacts): CompanyRecord | null {
  if (!k.recordSource) return null;
  const website = k.officialDomain ? `https://${k.officialDomain}` : null;
  return { label: k.recordLabel ?? k.name, description: k.description, website, domain: k.officialDomain, founded: k.foundedYear, sourceUrl: k.recordSource };
}

/**
 * Adds one check to the employer's record. New facts replace old ones only when present,
 * so a check whose search was down never wipes what an earlier check found. `fresh` is
 * false when the facts came from this record, so its date isn't moved on.
 */
export async function rememberCompany(employer: string | null, facts: Omit<CompanyFacts, "name" | "checkedAt">, opts: { fresh: boolean; redFlags: boolean; state: string }): Promise<void> {
  const key = normaliseName(employer ?? "").slice(0, 160);
  if (!key || !employer || !enabled()) return;
  try {
    const db = createAdminClient();
    const { data } = await db.from("company_records").select("*").eq("normalised_name", key).maybeSingle();
    const old = data as Row | null;
    const now = new Date().toISOString();
    const keep = <T,>(next: T | null, prev: T | null | undefined) => (next ?? prev ?? null) as T | null;
    await db.from("company_records").upsert(
      {
        normalised_name: key,
        name: old?.name ?? employer.trim().slice(0, 160),
        official_domain: keep(facts.officialDomain, old?.official_domain),
        exists_state: facts.exists !== "unknown" ? facts.exists : (old?.exists_state ?? "unknown"),
        description: keep(facts.description, old?.description),
        founded_year: keep(facts.foundedYear, old?.founded_year),
        founded_source: keep(facts.foundedSource, old?.founded_source),
        record_label: keep(facts.recordLabel, old?.record_label),
        record_source: keep(facts.recordSource, old?.record_source),
        checked_at: opts.fresh || !old ? now : old.checked_at,
        checks: (old?.checks ?? 0) + 1,
        posts_with_red_flags: (old?.posts_with_red_flags ?? 0) + (opts.redFlags ? 1 : 0),
        last_state: opts.state,
        updated_at: now,
      },
      { onConflict: "normalised_name" },
    );
  } catch {
    // The check itself already answered; the record catches up next time.
  }
}
