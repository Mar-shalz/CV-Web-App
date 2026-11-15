import { describe, expect, it } from "vitest";
import { textCheck } from "@/lib/rules/scam/quick";
import { RETURN_PATHS, isReturnPath } from "@/lib/auth/next-path";

const PLAIN =
  "Northbridge Bank is hiring a Graduate Trainee in Finance. You need a second class upper degree and your NYSC discharge certificate. Send your CV to careers@northbridgebank.com before the closing date. Salary is 250,000 naira monthly.";

describe("public quick check (round 50)", () => {
  it("finds no warning sign in an ordinary post, salary included", () => {
    expect(textCheck(PLAIN)).toEqual([]);
  });

  it("flags a request to pay, with the post's own sentence as evidence", () => {
    const [first] = textCheck(`${PLAIN} Shortlisted candidates pay a registration fee of 5,000 naira before the test.`);
    expect(first?.id).toBe("L1-01");
    expect(first?.severity).toBe("red");
    expect(first?.evidence).toContain("registration fee");
  });

  it("flags a post that can only be answered on WhatsApp", () => {
    const ids = textCheck("We are recruiting sales assistants in Lagos for immediate start. Interested candidates should chat the manager on WhatsApp https://wa.me/2348000000000 to apply today.").map((s) => s.id);
    expect(ids).toContain("L1-06");
  });

  it("does not call a post chat only when it gives a company email", () => {
    const ids = textCheck(`${PLAIN} You can also ask questions on WhatsApp.`).map((s) => s.id);
    expect(ids).not.toContain("L1-06");
  });
});

describe("where sign in returns to (round 50)", () => {
  it("keeps the landing page's starting points and nothing from outside", () => {
    for (const p of ["/applications/new", "/jobs/real", "/matches", "/extension"]) expect(isReturnPath(p)).toBe(true);
    expect(isReturnPath("https://evil.example")).toBe(false);
    expect(isReturnPath("//evil.example")).toBe(false);
    expect(RETURN_PATHS.every((p) => p.startsWith("/") && !p.startsWith("//"))).toBe(true);
  });
});
