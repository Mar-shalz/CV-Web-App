import { describe, expect, it } from "vitest";
import { matchPercent, requirementKey } from "@/lib/rules/match-score";

const req = (text: string, status: "met" | "partly" | "missing") => ({ text, status, vaultItemIds: [], note: null });

describe("match percentage (D-164)", () => {
  const job = [
    { text: "Excel and financial reporting", importance: "must" as const },
    { text: "ICAN membership", importance: "nice" as const },
    { text: "Customer service", importance: "must" as const },
  ];

  it("weights must-haves twice and counts partly as half", () => {
    // must met (2) + nice missing (0 of 1) + must partly (1 of 2) = 3 of 5
    expect(matchPercent([req("Excel and financial reporting", "met"), req("ICAN membership", "missing"), req("Customer service", "partly")], job)).toBe(60);
  });

  it("counts a skill the person added on the check as met", () => {
    const added = new Set([requirementKey("ICAN membership")]);
    expect(matchPercent([req("Excel and financial reporting", "met"), req("ICAN membership", "missing"), req("Customer service", "met")], job, added)).toBe(100);
  });

  it("has no score without requirements", () => {
    expect(matchPercent([], job)).toBeNull();
  });
});

import { alignVerdict } from "@/lib/rules/verdict";

describe("advice follows the match (D-174)", () => {
  const job = [
    { text: "Figma", importance: "must" as const },
    { text: "Design systems", importance: "must" as const },
    { text: "User research", importance: "must" as const },
    { text: "Claude Design", importance: "must" as const },
  ];
  const elig = (overall: "pass" | "unknown") => ({ ruleSetVersion: "t", overall, outcomes: [] });
  const care = { verdict: "apply_with_care" as const, line: "Apply with care.", gaps: [{ gap: "Claude Design tool experience", addressIn: "email" as const, how: "x" }], forcedByRules: false };

  it("turns care into apply at 85% or more when every hard rule is met", () => {
    const v = alignVerdict({ ...care, requirements: [req("Figma", "met"), req("Design systems", "met"), req("User research", "met"), req("Claude Design", "partly")] }, job, elig("pass"));
    expect(v.verdict).toBe("apply");
    expect(v.line).toContain("88%");
    expect(v.line).toContain("Claude Design tool experience");
  });

  it("keeps care when a hard rule is still unknown", () => {
    const v = alignVerdict({ ...care, requirements: [req("Figma", "met"), req("Design systems", "met"), req("User research", "met"), req("Claude Design", "met")] }, job, elig("unknown"));
    expect(v.verdict).toBe("apply_with_care");
  });

  it("never says a plain apply under 50%", () => {
    const v = alignVerdict({ ...care, verdict: "apply", requirements: [req("Figma", "met"), req("Design systems", "missing"), req("User research", "missing"), req("Claude Design", "missing")] }, job, elig("pass"));
    expect(v.verdict).toBe("apply_with_care");
  });
});

import { noEmDashes } from "@/lib/ai";

describe("model output never carries an em dash (round 24)", () => {
  it("cleans every string, deeply", () => {
    expect(noEmDashes({ a: "Led reconciliation — every month", b: ["x—y"], n: 3 })).toEqual({ a: "Led reconciliation, every month", b: ["x, y"], n: 3 });
  });
});
