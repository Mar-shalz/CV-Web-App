"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/env";
import { track } from "@/lib/analytics/server";

export type WaitlistState = { ok?: boolean; error?: string } | undefined;

const schema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter an email address like name@gmail.com" };
  const source = String(formData.get("source") ?? "landing").slice(0, 40);

  if (!isPreviewMode()) {
    const supabase = await createClient();
    const { error } = await supabase.from("waitlist").insert({ email: parsed.data.email, source });
    // 23505: already on the list. Treat as success and reveal nothing.
    if (error && error.code !== "23505") return { error: "We couldn't add you just now. Try again in a minute." };
  }
  await track("waitlist_joined", { source });
  return { ok: true };
}

export async function priceClicked(product: string): Promise<void> {
  await track("landing_price_clicked", { product: product.slice(0, 40) });
}
