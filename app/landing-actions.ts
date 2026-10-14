"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPreviewMode } from "@/lib/env";
import { track } from "@/lib/analytics/server";

/**
 * The price on the landing page: counts the tap as willingness to pay (D-111), then
 * goes to sign in. Anonymous: a random id from this browser only, no IP, no account.
 */
export async function priceClicked(formData: FormData): Promise<void> {
  const product = String(formData.get("product") ?? "job_hunt_30d").slice(0, 40);
  const visitor = String(formData.get("visitor") ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 64) || null;
  if (!isPreviewMode()) {
    try {
      await createAdminClient().from("price_clicks").insert({ visitor, source: product });
    } catch {
      // Counting must never stop someone signing up.
    }
  }
  await track("landing_price_clicked", { product });
  redirect("/sign-in?from=price");
}
