import { NextResponse, after, type NextRequest } from "next/server";
import { getStaff, logAdminAction } from "@/lib/admin/auth";
import { can, maskEmail } from "@/lib/admin/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserHit = { id: string; email: string; name: string | null };

const PREVIEW: UserHit[] = [
  { id: "00000000-0000-4000-8000-000000000001", email: "tolu.adebayo@gmail.com", name: "Tolu Adebayo" },
  { id: "00000000-0000-4000-8000-000000000002", email: "tobi.okafor@yahoo.com", name: "Tobi Okafor" },
];

/**
 * People for the "One person" field, as the name or email is typed (D-132, D-141). A GET
 * route, not a server action, so typing fast runs searches side by side and the browser
 * cancels the stale ones (server actions run one at a time). One round trip: emails and
 * names are matched in parallel, each with the other field joined in. Full emails only for
 * roles that may see them.
 */
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff || !staff.mfa || !can(staff.role, "messages")) return NextResponse.json({ hits: [] }, { status: 404 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  if (staff.preview) return NextResponse.json({ hits: PREVIEW.filter((u) => `${u.email} ${u.name}`.toLowerCase().includes(q)) });

  // The text is matched as text: wildcards and escapes in it are neutralised.
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const db = createAdminClient();
  const [byEmail, byName] = await Promise.all([
    db.from("users").select("id, email, profiles(full_name)").ilike("email", like).order("email").limit(8),
    db.from("profiles").select("user_id, full_name, users!inner(email)").ilike("full_name", like).limit(8),
  ]);
  const full = can(staff.role, "users.manage");
  const seen = new Set<string>();
  const hits: UserHit[] = [];
  const add = (id: string, email: string | undefined, name: string | null | undefined) => {
    if (!email || seen.has(id) || hits.length >= 8) return;
    seen.add(id);
    hits.push({ id, email: full ? email : maskEmail(email), name: name ?? null });
  };
  const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));
  for (const u of byEmail.data ?? []) add(u.id as string, u.email as string, one(u.profiles as { full_name: string | null } | { full_name: string | null }[] | null)?.full_name);
  for (const p of byName.data ?? []) add(p.user_id as string, one(p.users as { email: string } | { email: string }[] | null)?.email, p.full_name as string | null);
  // Logged after the answer is sent, so it never slows the list down.
  if (hits.length) after(() => logAdminAction(staff, "view", "users", null, { purpose: "message_lookup", results: hits.length }));
  return NextResponse.json({ hits }, { headers: { "cache-control": "private, no-store" } });
}
