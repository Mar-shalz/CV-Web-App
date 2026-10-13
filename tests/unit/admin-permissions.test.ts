import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, can, maskEmail, PERMISSIONS } from "@/lib/admin/permissions";

describe("back office permissions", () => {
  it("owner can do everything", () => {
    for (const p of PERMISSIONS) expect(can("owner", p)).toBe(true);
  });
  it("only the owner manages the team and publishes rules", () => {
    for (const r of ADMIN_ROLES.filter((r) => r !== "owner")) {
      expect(can(r, "team")).toBe(false);
      expect(can(r, "rules.publish")).toBe(false);
      expect(can(r, "audit")).toBe(false);
    }
  });
  it("support never sees payments; finance never sees users", () => {
    expect(can("support", "payments")).toBe(false);
    expect(can("finance", "users")).toBe(false);
  });
  it("only the owner sees full emails and can pause or delete accounts", () => {
    expect(ADMIN_ROLES.filter((r) => can(r, "users.manage"))).toEqual(["owner"]);
  });
  it("refunds are owner and finance only", () => {
    expect(ADMIN_ROLES.filter((r) => can(r, "payments.refund"))).toEqual(["owner", "finance"]);
  });
  it("no role means no access", () => {
    expect(can(null, "overview")).toBe(false);
  });
  it("masks emails", () => {
    expect(maskEmail("tolu.adebayo@gmail.com")).toBe("to•••@gm•••.com");
    expect(maskEmail("tolu.adebayo@gmail.com")).not.toContain("adebayo");
    expect(maskEmail(null)).toBe("Unknown");
  });
});

describe("messages to users", () => {
  it("lets owners and support send updates, and nobody else", () => {
    expect(can("owner", "messages")).toBe(true);
    expect(can("support", "messages")).toBe(true);
    expect(can("reviewer", "messages")).toBe(false);
    expect(can("finance", "messages")).toBe(false);
  });
});
