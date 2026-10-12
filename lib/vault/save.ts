import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftRole } from "./schema";
import { toDate } from "./dates";

/**
 * Saves parsed or interviewed roles as UNCONFIRMED rows. Nothing counts as evidence
 * until the user confirms it on the review screen.
 */
export async function saveDraftRoles(supabase: SupabaseClient, userId: string, roles: DraftRole[], source: "cv_import" | "voice" | "text") {
  let roleCount = 0;
  let itemCount = 0;
  for (const r of roles) {
    const { data: role, error } = await supabase
      .from("vault_roles")
      .insert({
        user_id: userId,
        kind: r.kind,
        organisation: r.organisation,
        title: r.title,
        location: r.location,
        start_date: toDate(r.start),
        end_date: r.is_current ? null : toDate(r.end),
        is_current: r.is_current,
        grade: r.grade,
        source,
        confirmed: false,
      })
      .select("id")
      .single();
    if (error || !role) continue;
    roleCount++;
    if (r.items.length) {
      const { error: itemError } = await supabase.from("vault_items").insert(
        r.items.map((i) => ({
          user_id: userId,
          role_id: role.id,
          text: i.text,
          metrics: i.metrics,
          skills: i.skills,
          ownership: i.ownership,
          source_quote: i.source_quote,
          source_type: source,
        })),
      );
      if (!itemError) itemCount += r.items.length;
    }
  }
  return { roleCount, itemCount };
}
