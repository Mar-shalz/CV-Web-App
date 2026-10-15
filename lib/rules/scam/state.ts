import type { Severity, Signal } from "./layer1";

// Layer 2 findings come from the server lookup (official careers page, domain match,
// CAC, domain age, official warnings, reported numbers, footprint, forum reports,
// whether the company exists (L2-09) and how long it has existed (L2-10)).
export type Finding = {
  id: "L2-01" | "L2-02" | "L2-03" | "L2-04" | "L2-05" | "L2-06" | "L2-07" | "L2-08" | "L2-09" | "L2-10" | "L2-11";
  result: "found" | "not_found" | "match" | "mismatch" | "warning" | "unknown";
  text: string;
  sourceUrl: string | null;
  sourceType: "official" | "registry" | "news" | "forum" | null;
  /** Set when web search was down, so the screen offers "Check again". */
  note?: "search_unavailable";
};

export type ScamState = "verified" | "unverified" | "red_flags";

/** What each Layer 2 finding adds, per Build pack section 9. Forum reports are never red. */
export function findingSeverity(f: Finding): Severity | null {
  switch (f.id) {
    case "L2-02":
      return f.result === "mismatch" ? "amber" : null;
    case "L2-04":
      return f.result === "warning" ? "amber" : null;
    case "L2-05":
      return f.result === "warning" && f.sourceType === "official" ? "red" : f.result === "warning" ? "amber" : null;
    case "L2-06":
    case "L2-07":
    case "L2-08":
    case "L2-10":
    case "L2-11":
      return f.result === "warning" ? "amber" : null;
    case "L2-09":
      return f.result === "not_found" ? "amber" : null;
    default:
      return null;
  }
}

/**
 * The final state, computed in code from both layers. There is no "safe" state, ever.
 * Red: any red signal, or an official warning covering this exercise.
 * Verified: listed by the company (its own site or hiring page, or under its name on a
 * known job site, D-161), and the email or apply link is on the company's own website or
 * hiring page, so the application reaches the real company. No red, no amber.
 * Everything else: couldn't verify.
 */
export function scamState(layer1: Signal[], findings: Finding[]): ScamState {
  const red = layer1.some((s) => s.severity === "red") || findings.some((f) => findingSeverity(f) === "red");
  if (red) return "red_flags";
  // A forum or news post advertising the job never counts: only the company's channels and job sites.
  const listed = findings.some((f) => f.id === "L2-01" && f.result === "found" && (f.sourceType === "official" || f.sourceType === null));
  const routeMatches = findings.some((f) => f.id === "L2-02" && f.result === "match");
  const amber = layer1.some((s) => s.severity === "amber") || findings.some((f) => findingSeverity(f) === "amber");
  return listed && routeMatches && !amber ? "verified" : "unverified";
}

export const STATE_HEADLINES: Record<ScamState, string> = {
  red_flags: "Red flags found",
  unverified: "Couldn't verify. Be careful.",
  verified: "Verified on an official channel",
};
