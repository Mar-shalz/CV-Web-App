import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PRICES } from "@/lib/config";

// Pure payment rules (Build pack Slice 9). Only a verified webhook unlocks a pass, and a
// duplicate webhook grants nothing. Tested in tests/unit/paystack-webhook.test.ts.

export type ProductId = keyof typeof PRICES.products;
export type PaystackEvent = { event: string; data: { reference: string; status: string; amount: number; currency: string; channel?: string | null } };
export type PendingPass = { id: string; status: string; amountKobo: number; type: string; reference: string };
export type Grant = { action: "activate" } | { action: "ignore"; reason: string } | { action: "fail"; reason: string };

/** Paystack signs the raw body with HMAC SHA512 using the secret key (x-paystack-signature). */
export function signatureValid(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function decideGrant(e: PaystackEvent, pass: PendingPass | null): Grant {
  if (!pass) return { action: "ignore", reason: "unknown_reference" };
  if (e.data.reference !== pass.reference) return { action: "ignore", reason: "reference_mismatch" };
  if (e.event !== "charge.success") return { action: "ignore", reason: "event_not_handled" };
  if (e.data.status === "failed") return { action: "fail", reason: "charge_failed" };
  if (e.data.status !== "success") return { action: "ignore", reason: "not_success" };
  if (e.data.currency !== PRICES.currency) return { action: "ignore", reason: "currency_mismatch" };
  if (e.data.amount !== pass.amountKobo) return { action: "ignore", reason: "amount_mismatch" };
  if (pass.status !== "pending") return { action: "ignore", reason: "not_pending" };
  return { action: "activate" };
}

export function productFor(id: string): { id: ProductId; label: string; amountKobo: number; days: number | null } | null {
  if (!(id in PRICES.products)) return null;
  const p = PRICES.products[id as ProductId];
  return { id: id as ProductId, label: p.label, amountKobo: p.amount_kobo, days: p.days };
}

/** Our own reference for each attempt: lowercase letters and digits, never guessable. */
export function newReference(): string {
  return `rcp_${randomBytes(16).toString("hex")}`;
}
