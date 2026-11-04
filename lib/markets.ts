import { MARKETS } from "@/lib/config";

// Where someone applies: Nigeria, abroad, or both (D-085). No country list: the job post
// decides the country for each CV (lib/rules/destination.ts).

/** Stored in users.target_markets for "abroad". Older accounts may hold country codes. */
export const ABROAD = "INTL";

export type Region = "nigeria" | "abroad" | "both";

export function regionOf(markets: string[]): Region | null {
  const home = markets.includes("NG");
  const away = markets.some((m) => m !== "NG");
  if (home && away) return "both";
  if (home) return "nigeria";
  if (away) return "abroad";
  return null;
}

export function marketsFor(region: Region): string[] {
  return region === "nigeria" ? ["NG"] : region === "abroad" ? [ABROAD] : ["NG", ABROAD];
}

export function marketsLabel(markets: string[]): string {
  const r = regionOf(markets);
  return r === "both" ? "Nigeria and abroad" : r === "abroad" ? "Abroad" : r === "nigeria" ? "Nigeria" : "";
}

/** Real country codes only, for destination detection. */
export function countryMarkets(markets: string[]): string[] {
  return markets.filter((m) => m !== ABROAD);
}

/**
 * Where Jobs for You looks for someone (founder rounds 40 to 42, D-211 to D-213): the country
 * they live in, the countries they apply to for office jobs ("Abroad" means the countries in
 * markets.json abroad_default; older accounts may name their own), and the countries they've
 * said they can already work in (profiles.right_to_work), where no visa is needed.
 */
export type Reach = { home: string; away: string[]; canWork: string[] };

export function reachOf(markets: string[], home: string, canWork: string[] = []): Reach {
  const named = countryMarkets(markets);
  const away = markets.includes(ABROAD) && !named.some((c) => c !== "NG") ? [...named, ...MARKETS.abroad_default] : named;
  return { home, away: [...new Set(away)].filter((c) => c !== home), canWork };
}

/** Country names from codes, for copy: "United Kingdom, Canada". */
export function countryNames(codes: string[]): string {
  return codes.map((c) => MARKETS.countries.find((m) => m.code === c)?.label ?? c).join(", ");
}
