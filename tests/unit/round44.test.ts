import { describe, expect, it } from "vitest";
import { SEND_FAILED, TOO_MANY, sendFailure } from "@/lib/auth/email-code";

// Founder round 44 (D-215): a sign in code that couldn't be sent says so, and the back office
// hears why.
describe("sendFailure", () => {
  it("says the email service couldn't send when Supabase only reaches its team", () => {
    expect(sendFailure({ status: 400, code: "email_address_not_authorized" })).toEqual({ reason: "email_address_not_authorized", error: SEND_FAILED, report: true });
  });

  it("reports an SMTP failure by its code", () => {
    expect(sendFailure({ status: 500, code: "unexpected_failure" })).toMatchObject({ reason: "unexpected_failure", error: SEND_FAILED, report: true });
  });

  it("asks people to wait when a rate limit is hit", () => {
    expect(sendFailure({ status: 429, code: "over_email_send_rate_limit" })).toMatchObject({ reason: "over_email_send_rate_limit", error: TOO_MANY });
    expect(sendFailure({ status: 429 })).toMatchObject({ reason: "rate_limited", error: TOO_MANY });
  });

  it("lets people fix an address Supabase can't use, without a report", () => {
    const f = sendFailure({ status: 400, code: "email_address_invalid" });
    expect(f.fieldError).toMatch(/email address/);
    expect(f.report).toBe(false);
  });

  it("never says whether an account exists", () => {
    expect(sendFailure({ status: 422, code: "otp_disabled" }).error).toBe(SEND_FAILED);
    expect(sendFailure({ status: 400, code: "user_not_found" }).error).toBe(SEND_FAILED);
  });

  it("falls back to the status, then a plain reason", () => {
    expect(sendFailure({ status: 503 }).reason).toBe("status_503");
    expect(sendFailure(null).reason).toBe("send_failed");
  });

  it("keeps the words free of em dashes", () => {
    for (const s of [SEND_FAILED, TOO_MANY]) expect(s).not.toMatch(/—/);
  });
});
