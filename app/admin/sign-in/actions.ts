"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/env";

/** Signed in with an account that isn't on the team: sign out here, then sign in with the team account. */
export async function switchAdminAccount(): Promise<void> {
  if (!isPreviewMode()) {
    const supabase = await createClient();
    await supabase.auth.signOut().catch(() => {});
  }
  redirect("/admin/sign-in?signed_out=1");
}
