import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { signatureValid, decideGrant, productFor, type PaystackEvent } from "@/lib/payments/rules";
import { verifyCharge } from "@/lib/payments/paystack";
import { PRICES } from "@/lib/config";
import { track } from "@/lib/analytics/server";

const MAX_BODY = 64_000;

/**
 * Paystack webhook: the only thing that unlocks a pass (Build pack Slice 9).
 * 1. The signature must match the raw body. 2. Each (reference, event) is accepted once,
 * so a repeated webhook grants nothing. 3. We ask Paystack to confirm the charge before
 * activating, and the database function activates a pending pass at most once.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
  if (!signatureValid(raw, request.headers.get("x-paystack-signature"), process.env.PAYSTACK_SECRET_KEY)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(raw) as PaystackEvent;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const reference = typeof event?.data?.reference === "string" ? event.data.reference : null;
  if (!reference || typeof event.event !== "string") return NextResponse.json({ ok: true });

  const db = createAdminClient();
  const sha = createHash("sha256").update(raw).digest("hex");
  const { error: seen } = await db.from("payment_events").insert({ reference, event: event.event, payload_sha256: sha });
  if (seen) {
    // 23505: we already handled this exact event. Anything else: let Paystack retry.
    return seen.code === "23505" ? NextResponse.json({ ok: true, duplicate: true }) : NextResponse.json({ ok: false }, { status: 500 });
  }
  const forget = () => db.from("payment_events").delete().eq("reference", reference).eq("event", event.event);

  const { data: p } = await db.from("passes").select("id, user_id, status, amount_kobo, type, paystack_reference").eq("paystack_reference", reference).maybeSingle();
  const grant = decideGrant(event, p ? { id: p.id, status: p.status, amountKobo: p.amount_kobo, type: p.type, reference: p.paystack_reference ?? "" } : null);

  if (grant.action === "fail" && p) {
    await db.from("passes").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", p.id).eq("status", "pending");
    await track("payment_failed", { reason: grant.reason }, p.user_id);
  }
  if (grant.action !== "activate" || !p) return NextResponse.json({ ok: true });

  try {
    const charge = await verifyCharge(reference);
    if (charge.status !== "success" || charge.amount !== p.amount_kobo || charge.currency !== PRICES.currency) return NextResponse.json({ ok: true });
    const days = productFor(p.type)?.days ?? 0;
    const { data: activated, error } = await db.rpc("activate_pass", { p_reference: reference, p_amount_kobo: p.amount_kobo, p_channel: charge.channel ?? "unknown", p_days: days });
    if (error) throw error;
    if (activated) await track("payment_succeeded", { product: p.type, channel: charge.channel ?? "unknown" }, p.user_id);
    return NextResponse.json({ ok: true });
  } catch {
    // Paystack retries failed webhooks; forget this one so the retry is handled.
    await forget();
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
