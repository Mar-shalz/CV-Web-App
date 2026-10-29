import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Staff } from "./auth";

// The company records job checks build up (D-200), and how much our own records saved.

export type CompanyRow = { name: string; website: string | null; exists: "yes" | "no" | "unknown"; founded: number | null; checks: number; redFlagPosts: number; checkedAt: string };
export type CompaniesData = { rows: CompanyRow[]; total: number; searchesSaved: number; readsSaved: number; searchesStored: number; ready: boolean };

const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export async function getCompanies(staff: Staff, q: string): Promise<CompaniesData> {
  if (staff.preview) {
    const rows: CompanyRow[] = [
      { name: "Northbridge Bank", website: "northbridgebank.example", exists: "yes", founded: 1998, checks: 41, redFlagPosts: 3, checkedAt: ago(2) },
      { name: "Lekki Foods Manufacturing", website: "lekkifoods.example", exists: "yes", founded: 2011, checks: 12, redFlagPosts: 0, checkedAt: ago(6) },
      { name: "Adeyemi & Co. Chartered Accountants", website: null, exists: "unknown", founded: null, checks: 4, redFlagPosts: 0, checkedAt: ago(11) },
    ];
    const like = q.toLowerCase();
    return { rows: rows.filter((r) => r.name.toLowerCase().includes(like)), total: rows.length, searchesSaved: 318, readsSaved: 57, searchesStored: 904, ready: true };
  }
  const db = createAdminClient();
  let list = db.from("company_records").select("name, official_domain, exists_state, founded_year, checks, posts_with_red_flags, checked_at", { count: "exact" }).order("checks", { ascending: false }).limit(100);
  if (q) list = list.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const [companies, cache] = await Promise.all([list, db.from("lookup_cache").select("kind, hits").limit(20_000)]);
  if (companies.error) return { rows: [], total: 0, searchesSaved: 0, readsSaved: 0, searchesStored: 0, ready: false };
  const hits = (cache.data ?? []) as { kind: string; hits: number }[];
  const sum = (kind: string) => hits.filter((h) => h.kind === kind).reduce((s, h) => s + (h.hits ?? 0), 0);
  return {
    rows: (companies.data ?? []).map((r) => ({ name: r.name, website: r.official_domain, exists: r.exists_state, founded: r.founded_year, checks: r.checks, redFlagPosts: r.posts_with_red_flags, checkedAt: r.checked_at })),
    total: companies.count ?? 0,
    searchesSaved: sum("search"),
    readsSaved: sum("legitimacy_read"),
    searchesStored: hits.filter((h) => h.kind === "search").length,
    ready: true,
  };
}
