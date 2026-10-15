import type { FinalRequirement } from "./verdict";

// The match percentage on the fit check (founder, round 20, D-164). Plain arithmetic in
// code, so it's the same every time: each requirement the job lists counts, must-haves
// twice as much as nice-to-haves; met counts fully, partly met half, missing nothing. A
// skill the person added for a requirement on this check counts as met (they said they
// have it). Hard rules (age, degree class, NYSC) are separate: the verdict already says.

export type JobRequirement = { text: string; importance: "must" | "nice" };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function importanceOf(text: string, job: JobRequirement[]): "must" | "nice" {
  const t = norm(text);
  const hit = job.find((j) => norm(j.text) === t) ?? job.find((j) => norm(j.text).includes(t) || t.includes(norm(j.text)));
  return hit?.importance ?? "must";
}

/** 0 to 100, or null when the job lists no requirements to compare. */
export function matchPercent(reqs: FinalRequirement[], job: JobRequirement[], addedFor: Set<string> = new Set()): number | null {
  if (!reqs.length) return null;
  let total = 0;
  let got = 0;
  for (const r of reqs) {
    const w = importanceOf(r.text, job) === "must" ? 2 : 1;
    const score = addedFor.has(norm(r.text)) ? 1 : r.status === "met" ? 1 : r.status === "partly" ? 0.5 : 0;
    total += w;
    got += w * score;
  }
  return Math.round((100 * got) / total);
}

export const requirementKey = norm;
