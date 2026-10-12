import { describe, expect, it } from "vitest";
import { finalizeVerdict } from "@/lib/rules/verdict";
import type { EligibilityResult } from "@/lib/rules/eligibility/types";

const pass: EligibilityResult = { ruleSetVersion: "v", overall: "pass", outcomes: [] };
const model = {
  verdict: "apply" as const,
  top_match: "your SIWES work",
  main_gap: null,
  requirements: [
    { text: "Excel", status: "met" as const, vault_item_ids: ["a"], note: null },
    { text: "Customer service", status: "met" as const, vault_item_ids: ["ghost"], note: null },
  ],
  gaps: [],
};

describe("finalizeVerdict", () => {
  it("any hard fail is Skip, quoting the rule's reason, whatever the model said", () => {
    const fail: EligibilityResult = { ruleSetVersion: "v", overall: "fail", outcomes: [{ type: "max_age", result: "fail", quote: "Not more than 26", reason: "The limit is 26. You'll be 28 then." }] };
    const v = finalizeVerdict(model, fail, new Set(["a"]));
    expect(v.verdict).toBe("skip");
    expect(v.forcedByRules).toBe(true);
    expect(v.line).toContain("You'll be 28 then.");
  });
  it("drops evidence ids that aren't in the confirmed vault, and 'met' without evidence becomes missing", () => {
    const v = finalizeVerdict(model, pass, new Set(["a"]));
    expect(v.requirements[1]).toMatchObject({ vaultItemIds: [], status: "missing" });
  });
  it("an unknown hard check caps Apply at Apply with care", () => {
    const unknown: EligibilityResult = { ruleSetVersion: "v", overall: "unknown", outcomes: [{ type: "max_age", result: "unknown", quote: "", reason: "", needs: "date_of_birth" }] };
    expect(finalizeVerdict(model, unknown, new Set(["a"])).verdict).toBe("apply_with_care");
  });
  it("uses the PRD copy for Apply", () => {
    expect(finalizeVerdict(model, pass, new Set(["a", "ghost"])).line).toBe("Apply. You meet every hard requirement and your strongest match is your SIWES work. Let's build this one.");
  });
  it("never shows a percentage or an em dash", () => {
    const v = finalizeVerdict({ ...model, verdict: "apply_with_care", main_gap: "Excel — modelling" }, pass, new Set(["a"]));
    expect(v.line).not.toMatch(/%|—/);
  });
  it("falls back to Apply with care when the model step failed", () => {
    expect(finalizeVerdict(null, pass, new Set()).verdict).toBe("apply_with_care");
  });
});
