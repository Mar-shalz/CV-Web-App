import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/viewer";
import { LIMITS } from "@/lib/config";
import type { EmploymentType, Metric, Ownership, RoleKind } from "./schema";
import { DEMO_VAULT } from "@/lib/demo/vault";

export type VaultItem = {
  id: string;
  roleId: string | null;
  text: string;
  metrics: Metric[];
  skills: string[];
  ownership: Ownership;
  sourceQuote: string | null;
  sourceType: "cv_import" | "voice" | "text";
  confirmed: boolean;
};

export type VaultRole = {
  id: string;
  kind: RoleKind;
  organisation: string | null;
  title: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  isCurrent: boolean;
  grade: string | null;
  /** Null means full time (or not said). */
  employmentType: EmploymentType | null;
  source: "cv_import" | "voice" | "text";
  confirmed: boolean;
  items: VaultItem[];
};

export type Vault = { roles: VaultRole[]; confirmedItems: number; totalItems: number; ready: boolean; unchecked: number };

type RoleRow = {
  id: string;
  kind: RoleKind;
  organisation: string | null;
  title: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  grade: string | null;
  employment_type?: EmploymentType | null;
  source: VaultRole["source"];
  confirmed: boolean;
};
type ItemRow = {
  id: string;
  role_id: string | null;
  text: string;
  metrics: Metric[];
  skills: string[];
  ownership: Ownership;
  source_quote: string | null;
  source_type: VaultItem["sourceType"];
  confirmed_at: string | null;
};

const KIND_ORDER: RoleKind[] = ["job", "nysc_ppa", "internship_siwes", "volunteer", "project", "education", "certification", "licence"];

export function summarise(roles: VaultRole[]): Vault {
  const items = roles.flatMap((r) => r.items);
  const confirmedItems = items.filter((i) => i.confirmed).length;
  const unchecked = items.filter((i) => !i.confirmed).length + roles.filter((r) => !r.confirmed).length;
  return { roles, confirmedItems, totalItems: items.length, ready: confirmedItems >= LIMITS.onboarding.vault_ready_items, unchecked };
}

function sortRoles(roles: VaultRole[]): VaultRole[] {
  return [...roles].sort((a, b) => {
    const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (k) return k;
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return (b.end ?? b.start ?? "").localeCompare(a.end ?? a.start ?? "");
  });
}

/** The whole vault for the signed in user, newest first within each kind. */
export async function getVault(viewer: Viewer): Promise<Vault> {
  if (viewer.preview) return summarise(DEMO_VAULT);
  const supabase = await createClient();
  const [{ data: roles }, { data: items }] = await Promise.all([
    // "*" so a new column (employment type) never breaks reads before its migration runs.
    supabase.from("vault_roles").select("*").eq("user_id", viewer.id),
    supabase.from("vault_items").select("id, role_id, text, metrics, skills, ownership, source_quote, source_type, confirmed_at").eq("user_id", viewer.id).order("created_at"),
  ]);
  const byRole = new Map<string | null, VaultItem[]>();
  for (const i of (items ?? []) as ItemRow[]) {
    const list = byRole.get(i.role_id) ?? [];
    list.push({
      id: i.id,
      roleId: i.role_id,
      text: i.text,
      metrics: i.metrics ?? [],
      skills: i.skills ?? [],
      ownership: i.ownership,
      sourceQuote: i.source_quote,
      sourceType: i.source_type,
      confirmed: Boolean(i.confirmed_at),
    });
    byRole.set(i.role_id, list);
  }
  const mapped: VaultRole[] = ((roles ?? []) as RoleRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    organisation: r.organisation,
    title: r.title,
    location: r.location,
    start: r.start_date?.slice(0, 7) ?? null,
    end: r.end_date?.slice(0, 7) ?? null,
    isCurrent: r.is_current,
    grade: r.grade,
    employmentType: r.employment_type ?? null,
    source: r.source,
    confirmed: r.confirmed,
    items: byRole.get(r.id) ?? [],
  }));
  return summarise(sortRoles(mapped));
}
