import { describe, expect, it } from "vitest";
import { quoteIsFrom } from "@/lib/vault/quote";

describe("quoteIsFrom", () => {
  const answer = "I did account opening, around 15 a day,  and I checked their documents.";
  it("accepts an exact piece of the answer, ignoring case and spacing", () => {
    expect(quoteIsFrom("around 15 a day, and I checked their documents", answer)).toBe(true);
    expect(quoteIsFrom("I DID ACCOUNT OPENING", answer)).toBe(true);
  });
  it("rejects words the person never said", () => {
    expect(quoteIsFrom("opened 30 accounts a day", answer)).toBe(false);
  });
  it("rejects empty or tiny quotes", () => {
    expect(quoteIsFrom("", answer)).toBe(false);
    expect(quoteIsFrom("I", answer)).toBe(false);
  });
});
