import "server-only";
import { cache } from "react";
import { z } from "zod";
import { LIMITS, PRICES } from "@/lib/config";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Charging, on or off, with every amount (founder round 30, D-196). While it is off the app
// is open: no prices, no trial, no limits beyond fair use, everywhere. The back office turns
// it on, and sets the amounts, without a deploy. The config files hold the defaults.

export const pricingSchema = z.object({
  charging: z.boolean(),
  trial: z.object({ days: z.number().int().min(1).max(60), cvs: z.number().int().min(1).max(100) }),
  pass: z.object({ amountKobo: z.number().int().min(10_000).max(100_000_000), days: z.number().int().min(1).max(365), cvs: z.number().int().min(1).max(1000) }),
  topup: z.object({ amountKobo: z.number().int().min(10_000).max(100_000_000), cvs: z.number().int().min(1).max(1000) }),
  boost: z.object({ amountKobo: z.number().int().min(10_000).max(100_000_000) }),
});
export type Pricing = z.infer<typeof pricingSchema>;

export const DEFAULT_PRICING: Pricing = {
  charging: Boolean((PRICES as { charging_default?: boolean }).charging_default),
  trial: { days: LIMITS.trial.days, cvs: LIMITS.trial.tailored_cv_cap },
  pass: { amountKobo: PRICES.products.job_hunt_30d.amount_kobo, days: PRICES.products.job_hunt_30d.days, cvs: PRICES.products.job_hunt_30d.tailored_cvs },
  topup: { amountKobo: PRICES.products.cv_topup.amount_kobo, cvs: PRICES.products.cv_topup.adds_cvs },
  boost: { amountKobo: PRICES.products.interview_boost.amount_kobo },
};

// Read at most once a minute per server, and right away after a change on this server.
let memo: { at: number; value: Pricing } | null = null;
export function forgetPricing() {
  memo = null;
}

/** The pricing in force. Falls back to the defaults when the setting can't be read. */
export const getPricing = cache(async (): Promise<Pricing> => {
  if (isPreviewMode() || !isSupabaseConfigured() || !(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) return DEFAULT_PRICING;
  if (memo && Date.now() - memo.at < 60_000) return memo.value;
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", "pricing").maybeSingle();
    const parsed = pricingSchema.safeParse({ ...DEFAULT_PRICING, ...((data?.value as object) ?? {}) });
    const value = parsed.success ? parsed.data : DEFAULT_PRICING;
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_PRICING;
  }
});

/** The products as checkout sells them, from the pricing in force. */
export function productsFrom(p: Pricing) {
  return {
    job_hunt_30d: { id: "job_hunt_30d" as const, label: PRICES.products.job_hunt_30d.label, amountKobo: p.pass.amountKobo, days: p.pass.days as number | null, cvs: p.pass.cvs },
    cv_topup: { id: "cv_topup" as const, label: PRICES.products.cv_topup.label, amountKobo: p.topup.amountKobo, days: null as number | null, cvs: p.topup.cvs },
    interview_boost: { id: "interview_boost" as const, label: PRICES.products.interview_boost.label, amountKobo: p.boost.amountKobo, days: null as number | null, cvs: 0 },
  };
}
