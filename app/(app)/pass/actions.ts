"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { productFor, newReference } from "@/lib/payments/rules";
import { initializeCharge, paystackConfigured } from "@/lib/payments/paystack";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { track } from "@/lib/analytics/server";

export type PayState = { error?: string } | undefined;

async function appUrl(): Promise<string> {
  // A fixed APP_URL in production stops a forged Host header steering the callback.
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const schema = z.object({ product: z.enum(["job_hunt_30d", "interview_boost"]), application: z.uuid().nullable() });

/** Creates a pending pass and sends the person to Paystack. Nothing unlocks until the webhook. */
export async function startPayment(_prev: PayState, formData: FormData): Promise<PayState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const parsed = schema.safeParse({ product: formData.get("product"), application: formData.get("application") || null });
  if (!parsed.success) return { error: "Choose what you'd like to buy." };
  const product = productFor(parsed.data.product);
  if (!product) return { error: "That product isn't available." };
  if (viewer.preview) redirect(`/pass/result?reference=preview_${product.id}`);
  if (product.id === "interview_boost" && !parsed.data.application) return { error: "Open the boost from the application you were invited for." };
  if (!paystackConfigured()) return { error: "Payments aren't switched on yet. Try again soon." };
  if (!(await allow("payment"))) return { error: RATE_LIMITED_MESSAGE };

  if (parsed.data.application) {
    const supabase = await createClient();
    const { data: app } = await supabase.from("applications").select("id").eq("id", parsed.data.application).eq("user_id", viewer.id).maybeSingle();
    if (!app) return { error: "We couldn't find that application." };
  }

  const reference = newReference();
  const { error } = await createAdminClient()
    .from("passes")
    .insert({ user_id: viewer.id, type: product.id, amount_kobo: product.amountKobo, paystack_reference: reference, status: "pending", application_id: parsed.data.application });
  if (error) return { error: "We couldn't start the payment. Try again." };

  let url: string;
  try {
    const res = await initializeCharge({
      email: viewer.email,
      amountKobo: product.amountKobo,
      reference,
      callbackUrl: `${await appUrl()}/pass/result?reference=${reference}`,
      metadata: { product: product.id },
    });
    url = res.authorizationUrl;
  } catch {
    await createAdminClient().from("passes").update({ status: "failed" }).eq("paystack_reference", reference).eq("status", "pending");
    return { error: "We couldn't reach Paystack. Check your connection and try again." };
  }
  await track("payment_started", { product: product.id, price: product.amountKobo / 100 }, viewer.id);
  redirect(url);
}
