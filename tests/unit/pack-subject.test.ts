import { describe, expect, it } from "vitest";
import { fillSubject, hasPlaceholder } from "@/lib/pack/subject";

const v = { fullName: "Tolu Adebayo", role: "Graduate Trainee", course: "Accounting" };

describe("subject lines (PRD F8)", () => {
  it("fills the employer's exact format", () => {
    expect(fillSubject("GTP2026: [Full Name], [Course]", v)).toBe("GTP2026: Tolu Adebayo, Accounting");
  });
  it("keeps the post's own capitals and punctuation", () => {
    expect(fillSubject("APPLICATION FOR (Position) - <Name>", v)).toBe("APPLICATION FOR Graduate Trainee - Tolu Adebayo");
  });
  it("uses the default when no format is given", () => {
    expect(fillSubject(null, v)).toBe("Application: Graduate Trainee, Tolu Adebayo");
  });
  it("leaves unknown placeholders visible", () => {
    expect(hasPlaceholder(fillSubject("Ref [Job Code]: [Name]", v))).toBe(true);
  });
});
