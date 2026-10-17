import { describe, expect, it } from "vitest";
import { formatEmailBody } from "@/lib/pack/body";

describe("application email layout (round 24)", () => {
  it("replaces whatever sign-off the model wrote with the person's real details", () => {
    const raw = "Dear Hiring Team,\n\nI'm applying for the role.\n\n\n\nMy CV is attached.\n\nKind regards,\nTolu Adebayo\n+234 803 000 0000\ntolu.adebayo@gmial.com";
    expect(formatEmailBody(raw, { name: "Tolu Adebayo", phone: "+234 803 000 0000", email: "tolu.adebayo@gmail.com" })).toBe(
      "Dear Hiring Team,\n\nI'm applying for the role.\n\nMy CV is attached.\n\nKind regards,\nTolu Adebayo\n+234 803 000 0000\ntolu.adebayo@gmail.com",
    );
  });

  it("adds a sign-off when there is none and skips missing details", () => {
    expect(formatEmailBody("Dear Hiring Team,\r\nHello.", { name: "Ada", phone: null, email: "ada@example.com" })).toBe("Dear Hiring Team,\nHello.\n\nKind regards,\nAda\nada@example.com");
  });
});
