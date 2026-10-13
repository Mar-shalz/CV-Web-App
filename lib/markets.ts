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
