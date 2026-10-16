import type { EligibilityResult } from "./eligibility/types";
import { matchPercent, type JobRequirement } from "./match-score";

export type Verdict = "apply" | "apply_with_care" | "skip";
export type ReqStatus = "met" | "partly" | "missing";
export type FinalRequirement = { text: string; status: ReqStatus; vaultItemIds: string[]; note: string | null };
export type FinalVerdict = {
  verdict: Verdict;
  line: string;
  requirements: FinalRequirement[];
  gaps: { gap: string; addressIn: "cv" | "email" | "interview"; how: string }[];
  forcedByRules: boolean;
};

type ModelVerdict = {
  verdict: Verdict;
  top_match: string | null;
  main_gap: string | null;
  requirements: { text: string; status: ReqStatus; vault_item_ids: string[]; note: string | null }[];
  gaps: { gap: string; address_in: "cv" | "email" | "interview"; how: string }[];
};

const strip = (s: string) => s.replace(/—/g, ",").replace(/\s+/g, " ").trim();

/**
 * Code has the last word on the verdict (Build pack sections 6 and 7):
 * any hard fail is Skip, quoting the post; an unknown hard check caps it at Apply with
 * care; cited evidence must exist in this person's confirmed vault.
 */
export function finalizeVerdict(model: ModelVerdict | null, eligibility: EligibilityResult, validIds: Set<string>): FinalVerdict {
  const requirements: FinalRequirement[] = (model?.requirements ?? []).map((r) => {
    const ids = r.vault_item_ids.filter((id) => validIds.has(id));
    // "met" with no surviving evidence is not met.
    const status: ReqStatus = r.status !== "missing" && ids.length === 0 ? "missing" : r.status;
    return { text: strip(r.text), status, vaultItemIds: ids, note: r.note ? strip(r.note) : null };
  });
  const gaps = (model?.gaps ?? []).map((g) => ({ gap: strip(g.gap), addressIn: g.address_in, how: strip(g.how) }));

  const failed = eligibility.outcomes.find((o) => o.result === "fail");
  if (failed) {
    return {
      verdict: "skip",
      line: `Skip this one. ${failed.reason} Your time is better spent on roles that fit you.`,
      requirements,
      gaps,
      forcedByRules: true,
    };
  }

  let verdict: Verdict = model?.verdict ?? "apply_with_care";
  if (verdict === "apply" && eligibility.overall === "unknown") verdict = "apply_with_care";
  if (verdict === "skip" && !failed && requirements.length && requirements.filter((r) => r.status !== "missing").length / requirements.length >= 0.5) verdict = "apply_with_care";

  const unknown = eligibility.outcomes.find((o) => o.result === "unknown");
  const gap = model?.main_gap ?? (unknown ? "one detail we still need" : null) ?? requirements.find((r) => r.status !== "met")?.text ?? null;
  const line =
    verdict === "apply"
      ? `Apply. You meet every hard requirement${model?.top_match ? ` and your strongest match is ${strip(model.top_match)}` : ""}. Let's build this one.`
      : verdict === "apply_with_care"
        ? `Apply with care. You fit most of this${gap ? `, but they want ${strip(gap).replace(/^they want /i, "")}` : ""}. Address it in your email, and be ready to talk about it.`
        : `Skip this one. Most of what they need isn't in your experience yet${gap ? `, especially ${strip(gap)}` : ""}. Your time is better spent on roles that fit you.`;
  return { verdict, line, requirements, gaps, forcedByRules: false };
}

/**
 * The advice agrees with the match percentage (founder, round 22, D-174): every hard rule
 * met and 85% or more of what the post asks for is "Apply", with any gap kept under
 * "Things to prepare"; under 50% is never a plain "Apply". Hard fails stay "Skip", and an
 * unknown hard rule still caps it at "Apply with care". Also applied to saved verdicts.
 */
export function alignVerdict(v: FinalVerdict, jobReqs: JobRequirement[], eligibility: EligibilityResult): FinalVerdict {
  if (v.forcedByRules || v.verdict === "skip") return v;
  const pct = matchPercent(v.requirements, jobReqs);
  if (pct === null) return v;
  const gap = v.gaps[0]?.gap ?? v.requirements.find((r) => r.status !== "met")?.text ?? null;
  if (v.verdict === "apply_with_care" && eligibility.overall !== "unknown" && pct >= 85) {
    return { ...v, verdict: "apply", line: `Apply. You meet every hard requirement and ${pct}% of what they ask for.${gap ? ` One thing to prepare: ${strip(gap).replace(/\.$/, "")}.` : ""} Let's build this one.` };
  }
  if (v.verdict === "apply" && pct < 50) {
    return { ...v, verdict: "apply_with_care", line: `Apply with care. You meet the hard requirements, but only ${pct}% of what they ask for${gap ? `, and they want ${strip(gap).replace(/^they want /i, "").replace(/\.$/, "")}` : ""}. Address it in your email, and be ready to talk about it.` };
  }
  return v;
}

