import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptField, encryptField } from "@/lib/crypto/sensitive";

beforeAll(() => {
  process.env.SENSITIVE_DATA_KEY_V1 = randomBytes(32).toString("base64");
});

describe("sensitive field encryption", () => {
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";

  it("round trips", () => {
    expect(decryptField(encryptField("1999-04-02", userA), userA)).toBe("1999-04-02");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptField("Lagos", userA)).not.toBe(encryptField("Lagos", userA));
  });

  it("fails when a ciphertext is moved to another user's row", () => {
    const ct = encryptField("Female", userA);
    expect(() => decryptField(ct, userB)).toThrow();
  });

  it("fails when the ciphertext is tampered with", () => {
    const [v, iv, tag, ct] = encryptField("Ogun", userA).split(".");
    const flipped = Buffer.from(ct!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decryptField([v, iv, tag, flipped.toString("base64url")].join("."), userA)).toThrow();
  });

  it("never stores plaintext", () => {
    expect(encryptField("1999-04-02", userA)).not.toContain("1999");
  });
});
