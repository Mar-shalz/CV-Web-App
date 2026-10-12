import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { signatureValid, decideGrant, newReference, productFor, type PaystackEvent, type PendingPass } from "@/lib/payments/rules";

const SECRET = "sk_test_example_not_real";
const sign = (body: string, secret = SECRET) => createHmac("sha512", secret).update(body).digest("hex");

const pass: PendingPass = { id: "p1", status: "pending", amountKobo: 500000, type: "job_hunt_30d", reference: "rcp_abc123" };
const event = (over: Partial<PaystackEvent["data"]> = {}, name = "charge.success"): PaystackEvent => ({
  event: name,
  data: { reference: "rcp_abc123", status: "success", amount: 500000, currency: "NGN", channel: "card", ...over },
});

describe("Paystack webhook signature", () => {
  it("accepts the HMAC SHA512 of the raw body with our secret key", () => {
    const body = JSON.stringify(event());
    expect(signatureValid(body, sign(body), SECRET)).toBe(true);
  });
  it("rejects a missing, wrong or tampered signature", () => {
    const body = JSON.stringify(event());
    expect(signatureValid(body, null, SECRET)).toBe(false);
    expect(signatureValid(body, "", SECRET)).toBe(false);
    expect(signatureValid(body, sign(body, "sk_test_other"), SECRET)).toBe(false);
    expect(signatureValid(body.replace("500000", "5000"), sign(body), SECRET)).toBe(false);
  });
  it("rejects everything when the secret isn't set", () => {
    const body = "{}";
    expect(signatureValid(body, sign(body, ""), "")).toBe(false);
  });
});

describe("granting a pass", () => {
  it("activates a pending pass on a successful charge for the exact amount in naira", () => {
    expect(decideGrant(event(), pass)).toEqual({ action: "activate" });
  });
  it("never grants twice: an active pass is left alone", () => {
    expect(decideGrant(event(), { ...pass, status: "active" })).toEqual({ action: "ignore", reason: "not_pending" });
  });
  it("ignores events that aren't a successful charge", () => {
    expect(decideGrant(event({}, "transfer.success"), pass).action).toBe("ignore");
    expect(decideGrant(event({ status: "failed" }), pass)).toEqual({ action: "fail", reason: "charge_failed" });
    expect(decideGrant(event({ status: "abandoned" }), pass).action).toBe("ignore");
  });
  it("refuses a wrong amount or currency", () => {
    expect(decideGrant(event({ amount: 150000 }), pass)).toEqual({ action: "ignore", reason: "amount_mismatch" });
    expect(decideGrant(event({ currency: "USD" }), pass)).toEqual({ action: "ignore", reason: "currency_mismatch" });
  });
  it("refuses a reference we didn't create", () => {
    expect(decideGrant(event({ reference: "rcp_other" }), pass)).toEqual({ action: "ignore", reason: "reference_mismatch" });
    expect(decideGrant(event(), null)).toEqual({ action: "ignore", reason: "unknown_reference" });
  });
});

describe("products and references", () => {
  it("reads prices from config, in kobo", () => {
    expect(productFor("job_hunt_30d")).toMatchObject({ amountKobo: 500000, days: 30 });
    expect(productFor("interview_boost")).toMatchObject({ amountKobo: 150000, days: null });
    expect(productFor("trial_3d")).toBeNull();
  });
  it("makes unguessable references in Paystack's allowed characters", () => {
    const a = newReference();
    const b = newReference();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^rcp_[a-z0-9]{24,}$/);
  });
});
