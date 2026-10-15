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
