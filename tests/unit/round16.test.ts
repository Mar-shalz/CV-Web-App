import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), after: () => {} }));

import { bearer } from "@/lib/ext/auth";
import { isReturnPath } from "@/lib/auth/next-path";
import { isCvStyle } from "@/lib/cv/styles";

const req = (h?: string) => ({ headers: new Headers(h ? { authorization: h } : {}) }) as unknown as Parameters<typeof bearer>[0];

describe("extension keys (D-144)", () => {
  it("reads only a well formed bearer key", () => {
    const key = "a".repeat(43);
    expect(bearer(req(`Bearer ${key}`))).toBe(key);
    expect(bearer(req("Bearer short"))).toBeNull();
    expect(bearer(req(`Basic ${key}`))).toBeNull();
    expect(bearer(req(`Bearer ${key}; drop table`))).toBeNull();
    expect(bearer(req())).toBeNull();
  });
});

describe("return after sign in", () => {
  it("allows only fixed paths", () => {
    expect(isReturnPath("/extension/connect")).toBe(true);
    expect(isReturnPath("//evil.example")).toBe(false);
    expect(isReturnPath("https://evil.example/extension/connect")).toBe(false);
    expect(isReturnPath(undefined)).toBe(false);
  });
});

describe("CV designs (D-142)", () => {
  it("accepts only the three designs", () => {
    expect(isCvStyle("modern")).toBe(true);
    expect(isCvStyle("fancy")).toBe(false);
  });
});

describe("shared checks (D-147)", () => {
  it("hides phone numbers and emails", async () => {
    vi.doMock("@/lib/legitimacy", () => ({ fullCheck: vi.fn() }));
    const { redact } = await import("@/lib/share");
    expect(redact("Call +234 803 000 0000 or mail hr.jobs2026@gmail.com now")).toBe("Call [number] or mail [email] now");
    expect(redact("Since 2015, about 11 years.")).toBe("Since 2015, about 11 years.");
  });
});
