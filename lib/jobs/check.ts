import "server-only";
import { createHash } from "node:crypto";
import type { Viewer } from "@/lib/auth/viewer";
import type { Vault } from "@/lib/vault/data";
import type { JobView } from "./data";
import { createClient } from "@/lib/supabase/server";
import { checkEligibility } from "@/lib/rules/eligibility";
import type { EligibilityResult } from "@/lib/rules/eligibility/types";
import { alignVerdict, finalizeVerdict, type FinalVerdict } from "@/lib/rules/verdict";
import { buildEligibilityProfile } from "@/lib/eligibility/profile";
import { runTask } from "@/lib/ai";
import { FILTER_LABELS } from "./labels";
import { track } from "@/lib/analytics/server";
import { DEMO_VERDICT } from "@/lib/demo/job";

export async function runEligibility(viewer: Viewer, job: JobView, vault: Vault): Promise<EligibilityResult> {
  const profile = await buildEligibilityProfile(viewer, vault, job.parsed.hard_filters);
  const result = checkEligibility({ filters: job.parsed.hard_filters, deadline: job.parsed.deadline, profile });
  if (!viewer.preview) {
    const supabase = await createClient();
    await supabase.from("eligibility_results").insert({ job_id: job.id, user_id: viewer.id, rule_set_version: result.ruleSetVersion, results: result.outcomes, overall: result.overall });
    await track("eligibility_checked", { overall: result.overall, failed_rule_types: result.outcomes.filter((o) => o.result === "fail").map((o) => o.type).join(",") }, viewer.id);
  }
  return result;
}

/** The vault version: changes whenever a confirmed item changes, so verdicts are recomputed then. */
function vaultVersion(vault: Vault): string {
  const items = vault.roles.flatMap((r) => r.items.filter((i) => i.confirmed).map((i) => `${i.id}:${i.text}`));
  const roles = vault.roles.filter((r) => r.confirmed).map((r) => `${r.id}:${r.title}:${r.grade}:${r.start}:${r.end}`);
  return createHash("sha256").update([...roles, ...items].sort().join("|")).digest("hex").slice(0, 16);
}

export async function getVerdict(viewer: Viewer, job: JobView, vault: Vault, eligibility: EligibilityResult): Promise<FinalVerdict> {
  const confirmed = vault.roles.filter((r) => r.confirmed).flatMap((r) => r.items.filter((i) => i.confirmed).map((i) => ({ id: i.id, text: i.text, role: `${r.title ?? ""} at ${r.organisation ?? ""}`.trim() })));
  const ids = new Set(confirmed.map((i) => i.id));

  if (viewer.preview) {
    return alignVerdict(finalizeVerdict(
      {
        verdict: DEMO_VERDICT.verdict,
        top_match: "your SIWES banking work",
        main_gap: null,
        requirements: DEMO_VERDICT.requirements.map((r, n) => ({ text: r.text, status: r.status, vault_item_ids: r.status === "missing" ? [] : [["i3", "i6", "i1", "i3"][n] ?? "i1"], note: null })),
        gaps: DEMO_VERDICT.gaps.map((g) => ({ gap: g.gap, address_in: "email" as const, how: g.fix })),
      },
      eligibility,
      ids,
    ), job.parsed.requirements, eligibility);
  }

  const key = createHash("sha256")
    .update([job.postHash, vaultVersion(vault), eligibility.outcomes.map((o) => `${o.type}:${o.result}`).join(",")].join("|"))
    .digest("hex")
    .slice(0, 32);
  const supabase = await createClient();
  const { data: cached } = await supabase.from("verdicts").select("verdict, line, requirements, gaps, forced_by_rules").eq("job_id", job.id).eq("cache_key", key).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (cached?.line) {
    return alignVerdict({ verdict: cached.verdict, line: cached.line, requirements: cached.requirements, gaps: cached.gaps, forcedByRules: cached.forced_by_rules }, job.parsed.requirements, eligibility);
  }

  const education = vault.roles.filter((r) => r.kind === "education" && r.confirmed).map((r) => [r.title, r.organisation, r.grade].filter(Boolean).join(", "));
  const res = await runTask(
    "fit_verdict",
    {
      job: { title: job.parsed.title ?? "This role", employer: job.parsed.employer_name ?? "the employer", requirements: job.parsed.requirements },
      eligibility: eligibility.outcomes.map((o) => ({ rule: o.type === "deadline" ? "Closing date" : FILTER_LABELS[o.type], result: o.result, reason: o.reason })),
      items: confirmed.slice(0, 80),
      education,
      cacheKey: key,
    },
    { userId: viewer.id },
  );
  const final = alignVerdict(finalizeVerdict(res.ok ? res.data : null, eligibility, ids), job.parsed.requirements, eligibility);
  await supabase.from("verdicts").insert({
    job_id: job.id,
    user_id: viewer.id,
    verdict: final.verdict,
    requirements: final.requirements,
    gaps: final.gaps,
    model: res.meta.model,
    cache_key: key,
    line: final.line,
    forced_by_rules: final.forcedByRules,
  });
  await supabase.from("jobs").update({ state: "checked" }).eq("id", job.id).eq("user_id", viewer.id).in("state", ["captured", "reviewed"]);
  await track("verdict_shown", { verdict: final.verdict }, viewer.id);
  return final;
}
