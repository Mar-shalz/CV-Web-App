import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPLOYMENT_KINDS, type DraftItem, type DraftRole } from "./schema";
import { toDate } from "./dates";

/** A saved role, for spotting the same role in another CV (D-184). */
export type ExistingRole = { id: string; kind: string; organisation: string | null; title: string | null; items: { text: string; source_quote: string | null }[] };

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(ltd|limited|plc|inc|nigeria)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The same role when the kind matches and the organisation and title read the same. */
export function sameRole(a: Pick<ExistingRole, "kind" | "organisation" | "title">, b: Pick<DraftRole, "kind" | "organisation" | "title">): boolean {
  if (a.kind !== b.kind) return false;
  const [ao, bo, at, bt] = [norm(a.organisation), norm(b.organisation), norm(a.title), norm(b.title)];
  if (!ao && !at) return false;
  return ao === bo && at === bt;
}

/** An item already saved under the role: the same words, ignoring case and punctuation. */
export function sameItem(saved: ExistingRole["items"], item: Pick<DraftItem, "text" | "source_quote">): boolean {
  const keys = new Set(saved.flatMap((s) => [norm(s.text), norm(s.source_quote)]).filter(Boolean));
  return keys.has(norm(item.text)) || keys.has(norm(item.source_quote));
}

function itemRows(userId: string, roleId: string, items: DraftItem[], source: string) {
  return items.map((i) => ({
    user_id: userId,
    role_id: roleId,
    text: i.text,
    metrics: i.metrics,
    skills: i.skills,
    ownership: i.ownership,
    source_quote: i.source_quote,
    source_type: source,
  }));
}

/**
 * Saves parsed or interviewed roles as UNCONFIRMED rows. Nothing counts as evidence
 * until the user confirms it on the review screen. With `existing` (adding a second CV,
 * D-184), a role already saved isn't saved twice: only its new items are added to it,
 * unconfirmed, for the person to check.
 */
export async function saveDraftRoles(supabase: SupabaseClient, userId: string, roles: DraftRole[], source: "cv_import" | "voice" | "text", existing: ExistingRole[] = []) {
  let roleCount = 0;
  let itemCount = 0;
  let mergedCount = 0;
  for (const r of roles) {
    const match = existing.find((e) => sameRole(e, r));
    if (match) {
      const fresh = r.items.filter((i) => !sameItem(match.items, i));
      if (fresh.length) {
        const { error } = await supabase.from("vault_items").insert(itemRows(userId, match.id, fresh, source));
        if (!error) {
          itemCount += fresh.length;
          match.items.push(...fresh.map((i) => ({ text: i.text, source_quote: i.source_quote })));
        }
      }
      mergedCount++;
      continue;
    }
    const row = {
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
    };
    const typed = r.employment_type && EMPLOYMENT_KINDS.includes(r.kind) ? { ...row, employment_type: r.employment_type } : row;
    let { data: role, error } = await supabase.from("vault_roles").insert(typed).select("id").single();
    // Before the employment type migration runs, save the role without it.
    if (error && typed !== row) ({ data: role, error } = await supabase.from("vault_roles").insert(row).select("id").single());
    if (error || !role) continue;
    roleCount++;
    if (r.items.length) {
      const { error: itemError } = await supabase.from("vault_items").insert(itemRows(userId, role.id, r.items, source));
      if (!itemError) itemCount += r.items.length;
    }
  }
  return { roleCount, itemCount, mergedCount };
}
