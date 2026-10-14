"use server";

import { redirect } from "next/navigation";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { isPreviewMode } from "@/lib/env";

/** Signed in to the back office with an account that isn't on the team: sign that out, then use the team account. */
export async function switchAdminAccount(): Promise<void> {
  if (!isPreviewMode()) {
    const supabase = await createAdminSessionClient();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }
  redirect("/admin/sign-in?signed_out=1");
}
