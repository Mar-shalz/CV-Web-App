import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETS } from "@/lib/config";
import { marketsLabel } from "@/lib/markets";
import { maskEmail } from "./permissions";
import type { Staff } from "./auth";

// Back office reads for people's accounts. Full emails only for staff with
// "users.manage" (the owner); everyone else sees them masked. CVs, job posts and
// sensitive details are never read here.

const DAY = 86_400_000;
const ago = (d: number, h = 0) => new Date(Date.now() - d * DAY - h * 3_600_000).toISOString();
const lagosDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);

export type PlanKind = "paid" | "free_access" | "trial" | "trial_ended" | "none";
export type Plan = { kind: PlanKind; label: string; until: string | null };
export type UserFilter = "all" | "paying" | "paid_ever" | "active" | "suspended";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  stage: string;
  markets: string;
  joined: string;
  setup: boolean;
  plan: Plan;
  /** Total paid, in kobo, refunds excluded. */
  paidKobo: number;
  activeDays30: number;
  lastActive: string | null;
  suspended: boolean;
};

export type UserStats = { total: number; paying: number; active7: number; new7: number };

export type UserDetail = UserRow & {
  phone: string | null;
  place: string | null;
  provider: string;
  lastSignIn: string | null;
  suspendedReason: string | null;
  isStaff: boolean;
  visits30: number;
  activeDays7: number;
  activity: { date: string; count: number }[];
  counts: { roles: number; items: number; confirmedItems: number; cvs: number; applications: number; interviews: number; offers: number };
  payments: { id: string; product: string; amountKobo: number; status: string; reference: string | null; created: string; endsAt: string | null }[];
  freeAccess: { until: string | null; note: string | null } | null;
};

const stageLabel = (id: string | null | undefined) => MARKETS.career_stages.find((s) => s.id === id)?.label ?? "Not set";
const PRODUCT: Record<string, string> = { job_hunt_30d: "Job hunt pass", interview_boost: "Interview boost", trial_3d: "Trial" };

type Pass = { user_id: string; type: string; status: string; amount_kobo: number; ends_at: string | null; starts_at: string | null; created_at: string; id: string; paystack_reference: string | null };
type Usage = { user_id: string; trial_started_at: string | null; trial_ends_at: string | null };
type Free = { email: string; ends_at: string | null; note: string | null };

function planFor(passes: Pass[], usage: Usage | undefined, free: Free | undefined): Plan {
  const now = Date.now();
  const live = passes
    .filter((p) => p.type === "job_hunt_30d" && p.status === "active" && p.ends_at && new Date(p.ends_at).getTime() > now)
    .sort((a, b) => (b.ends_at ?? "").localeCompare(a.ends_at ?? ""))[0];
  if (live) return { kind: "paid", label: "Pass", until: live.ends_at };
  if (free && (!free.ends_at || new Date(free.ends_at).getTime() > now)) return { kind: "free_access", label: "Free access", until: free.ends_at };
  if (usage?.trial_ends_at && new Date(usage.trial_ends_at).getTime() > now) return { kind: "trial", label: "Trial", until: usage.trial_ends_at };
  if (usage?.trial_started_at) return { kind: "trial_ended", label: "Trial ended", until: usage.trial_ends_at };
  return { kind: "none", label: "No pass", until: null };
}

const paidTotal = (passes: Pass[]) => passes.filter((p) => p.type !== "trial_3d" && (p.status === "active" || p.status === "expired")).reduce((s, p) => s + p.amount_kobo, 0);

// ---------------------------------------------------------------------------
// Preview samples (fictional people)
// ---------------------------------------------------------------------------
const SAMPLE: (Omit<UserRow, "email"> & { rawEmail: string })[] = [
  { id: "u1", rawEmail: "tolu.adebayo@gmail.com", name: "Tolu Adebayo", stage: stageLabel("nysc"), markets: "Nigeria and abroad", joined: ago(0, 3), setup: true, plan: { kind: "paid", label: "Pass", until: ago(-24) }, paidKobo: 500000, activeDays30: 14, lastActive: ago(0, 1), suspended: false },
  { id: "u2", rawEmail: "chidi.okafor@yahoo.com", name: "Chidi Okafor", stage: stageLabel("graduate_0_3"), markets: "Nigeria", joined: ago(1), setup: true, plan: { kind: "trial", label: "Trial", until: ago(-2) }, paidKobo: 0, activeDays30: 2, lastActive: ago(0, 5), suspended: false },
  { id: "u3", rawEmail: "amaka.eze@outlook.com", name: "Amaka Eze", stage: stageLabel("experienced_3_plus"), markets: "Abroad", joined: ago(9), setup: true, plan: { kind: "free_access", label: "Free access", until: null }, paidKobo: 0, activeDays30: 6, lastActive: ago(2), suspended: false },
  { id: "u4", rawEmail: "ife.bello@gmail.com", name: null, stage: stageLabel(null), markets: "", joined: ago(2, 5), setup: false, plan: { kind: "none", label: "No pass", until: null }, paidKobo: 0, activeDays30: 1, lastActive: ago(2, 5), suspended: false },
  { id: "u5", rawEmail: "kunle.ade@gmail.com", name: "Kunle Ade", stage: stageLabel("final_year"), markets: "Nigeria", joined: ago(20), setup: true, plan: { kind: "trial_ended", label: "Trial ended", until: ago(17) }, paidKobo: 650000, activeDays30: 0, lastActive: ago(12), suspended: true },
];

function previewRows(full: boolean, q: string | undefined, filter: UserFilter): UserRow[] {
  const keep = (r: (typeof SAMPLE)[number]) =>
    filter === "paying" ? r.plan.kind === "paid" : filter === "paid_ever" ? r.paidKobo > 0 : filter === "active" ? Date.now() - new Date(r.lastActive ?? 0).getTime() < 7 * DAY : filter === "suspended" ? r.suspended : true;
  return SAMPLE.filter((r) => (q ? r.rawEmail.includes(q) || (r.name ?? "").toLowerCase().includes(q) : true))
    .filter(keep)
    .map(({ rawEmail, ...r }) => ({ ...r, email: full ? rawEmail : maskEmail(rawEmail) }));
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export async function listUsers(staff: Staff, opts: { q?: string; filter: UserFilter; full: boolean }): Promise<{ rows: UserRow[]; stats: UserStats; note: string | null }> {
  const { q, filter, full } = opts;
  if (staff.preview) {
    return { rows: previewRows(full, q, filter), stats: { total: 412, paying: 37, active7: 158, new7: 64 }, note: null };
  }
  const db = createAdminClient();
  const since30 = lagosDay(new Date(Date.now() - 29 * DAY));
  const since7 = lagosDay(new Date(Date.now() - 6 * DAY));
  let note: string | null = null;

  // Narrow the set first for filters that live in other tables.
  let ids: string[] | null = null;
  if (filter === "paying" || filter === "paid_ever") {
    let pq = db.from("passes").select("user_id").neq("type", "trial_3d");
    pq = filter === "paying" ? pq.eq("status", "active").gt("ends_at", new Date().toISOString()) : pq.in("status", ["active", "expired"]);
    const { data } = await pq.limit(5000);
    ids = [...new Set((data ?? []).map((p) => p.user_id as string))];
  } else if (filter === "active") {
    const { data, error } = await db.from("user_activity").select("user_id").gte("day", since7).limit(5000);
    if (error) note = "Usage shows once the latest database update has been run.";
    ids = [...new Set((data ?? []).map((a) => a.user_id as string))];
  }

  let query = db.from("users").select("*").order("created_at", { ascending: false }).limit(100);
  if (ids) query = query.in("id", ids.length ? ids.slice(0, 1000) : ["00000000-0000-0000-0000-000000000000"]);
  if (filter === "suspended") query = query.not("suspended_at", "is", null);
  if (q) {
    const clean = q.replace(/[%_,()]/g, "");
    // Owner: anywhere in the email. Others: from the start only, for support requests.
    query = query.ilike("email", full ? `%${clean}%` : `${clean}%`);
  }
  const { data: users, error: usersError } = await query;
  if (usersError && filter === "suspended") return { rows: [], stats: await stats(db, since7), note: "Paused accounts show once the latest database update has been run." };
  const list = (users ?? []) as Record<string, unknown>[];
  const userIds = list.map((u) => u.id as string);
  const emails = list.map((u) => String(u.email ?? "").toLowerCase()).filter(Boolean);

  const [passes, usage, free, activity, profiles] = userIds.length
    ? await Promise.all([
        db.from("passes").select("id, user_id, type, status, amount_kobo, ends_at, starts_at, created_at, paystack_reference").in("user_id", userIds),
        db.from("usage_counters").select("user_id, trial_started_at, trial_ends_at").in("user_id", userIds),
        db.from("free_access").select("email, ends_at, note").is("revoked_at", null).in("email", emails),
        db.from("user_activity").select("user_id, day, last_at").in("user_id", userIds).gte("day", since30),
        db.from("profiles").select("user_id, full_name").in("user_id", userIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const byUser = <T extends { user_id: string }>(rows: T[] | null | undefined) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]);
    return m;
  };
  const passMap = byUser(passes.data as Pass[] | null);
  const usageMap = new Map(((usage.data ?? []) as Usage[]).map((u) => [u.user_id, u]));
  const freeMap = new Map(((free.data ?? []) as Free[]).map((f) => [f.email.toLowerCase(), f]));
  const actMap = byUser(activity.data as { user_id: string; day: string; last_at: string }[] | null);
  const nameMap = new Map(((profiles.data ?? []) as { user_id: string; full_name: string | null }[]).map((p) => [p.user_id, p.full_name]));

  const rows: UserRow[] = list.map((u) => {
    const id = u.id as string;
    const email = String(u.email ?? "");
    const acts = actMap.get(id) ?? [];
    const myPasses = passMap.get(id) ?? [];
    return {
      id,
      email: full ? email : maskEmail(email),
      name: nameMap.get(id) ?? null,
      stage: stageLabel(u.career_stage as string | null),
      markets: marketsLabel((u.target_markets as string[] | null) ?? []),
      joined: u.created_at as string,
      setup: Boolean(u.setup_completed_at),
      plan: planFor(myPasses, usageMap.get(id), freeMap.get(email.toLowerCase())),
      paidKobo: paidTotal(myPasses),
      activeDays30: acts.length,
      lastActive: acts.map((a) => a.last_at).sort().at(-1) ?? null,
      suspended: Boolean(u.suspended_at),
    };
  });
  return { rows, stats: await stats(db, since7), note };
}

async function stats(db: ReturnType<typeof createAdminClient>, since7: string): Promise<UserStats> {
  const [total, paying, active, fresh] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("passes").select("user_id").eq("type", "job_hunt_30d").eq("status", "active").gt("ends_at", new Date().toISOString()).limit(10000),
    db.from("user_activity").select("user_id").gte("day", since7).limit(20000),
    db.from("users").select("id", { count: "exact", head: true }).gte("created_at", ago(7)),
  ]);
  return {
    total: total.count ?? 0,
    paying: new Set((paying.data ?? []).map((p) => p.user_id)).size,
    active7: new Set((active.data ?? []).map((a) => a.user_id)).size,
    new7: fresh.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// One person
// ---------------------------------------------------------------------------
function last30(acts: { day: string; views: number }[]): { date: string; count: number }[] {
  const byDay = new Map(acts.map((a) => [a.day, a.views]));
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * DAY);
    const key = lagosDay(d);
    return { date: `${key}T12:00:00.000Z`, count: byDay.get(key) ?? 0 };
  });
}

export async function getUserDetail(staff: Staff, id: string, full: boolean): Promise<UserDetail | null> {
  if (staff.preview) {
    const s = SAMPLE.find((u) => u.id === id);
    if (!s) return null;
    const { rawEmail, ...r } = s;
    const acts = Array.from({ length: 30 }, (_, i) => ({ day: lagosDay(new Date(Date.now() - (29 - i) * DAY)), views: [0, 0, 3, 5, 0, 2, 8, 0, 1, 4, 0, 0, 6, 2, 0, 3, 7, 0, 0, 2, 5, 1, 0, 4, 9, 0, 2, 3, 0, 6][i] ?? 0 })).filter((a) => a.views > 0 && r.activeDays30 > 0);
    return {
      ...r,
      email: full ? rawEmail : maskEmail(rawEmail),
      phone: full ? "+234 8031234567" : null,
      place: "Yaba, Lagos",
      provider: "email",
      lastSignIn: r.lastActive,
      suspendedReason: r.suspended ? "Shared one account with several people" : null,
      isStaff: false,
      visits30: acts.reduce((n, a) => n + a.views, 0),
      activeDays7: acts.filter((a) => a.day >= lagosDay(new Date(Date.now() - 6 * DAY))).length,
      activity: last30(acts),
      counts: { roles: 6, items: 18, confirmedItems: 15, cvs: 7, applications: 9, interviews: 2, offers: 0 },
      payments: r.paidKobo ? [{ id: "p1", product: "Job hunt pass", amountKobo: 500000, status: "active", reference: "PSK_7f3a91", created: ago(6), endsAt: ago(-24) }] : [],
      freeAccess: r.plan.kind === "free_access" ? { until: null, note: "Tester" } : null,
    };
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = createAdminClient();
  const { data: u } = await db.from("users").select("*").eq("id", id).maybeSingle();
  if (!u) return null;
  const email = String(u.email ?? "");
  const since30 = lagosDay(new Date(Date.now() - 29 * DAY));
  const since7 = lagosDay(new Date(Date.now() - 6 * DAY));
  const head = { count: "exact", head: true } as const;
  const [profile, passes, usage, free, activity, auth, staffRow, roles, items, confirmed, cvs, apps, interviews, offers] = await Promise.all([
    db.from("profiles").select("full_name, phone, city, state").eq("user_id", id).maybeSingle(),
    db.from("passes").select("id, user_id, type, status, amount_kobo, ends_at, starts_at, created_at, paystack_reference").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("usage_counters").select("user_id, trial_started_at, trial_ends_at").eq("user_id", id).maybeSingle(),
    db.from("free_access").select("email, ends_at, note").is("revoked_at", null).eq("email", email.toLowerCase()).maybeSingle(),
    db.from("user_activity").select("day, views, last_at").eq("user_id", id).gte("day", since30),
    db.auth.admin.getUserById(id),
    db.from("admin_members").select("user_id").eq("user_id", id).is("revoked_at", null).maybeSingle(),
    db.from("vault_roles").select("id", head).eq("user_id", id),
    db.from("vault_items").select("id", head).eq("user_id", id),
    db.from("vault_items").select("id", head).eq("user_id", id).not("confirmed_at", "is", null),
    db.from("cv_versions").select("id", head).eq("user_id", id),
    db.from("applications").select("id", head).eq("user_id", id),
    db.from("applications").select("id", head).eq("user_id", id).in("status", ["interview", "second_interview", "assessment", "offer", "accepted"]),
    db.from("applications").select("id", head).eq("user_id", id).in("status", ["offer", "accepted"]),
  ]);
  const myPasses = (passes.data ?? []) as Pass[];
  const acts = (activity.data ?? []) as { day: string; views: number; last_at: string }[];
  const p = profile.data as { full_name: string | null; phone: string | null; city: string | null; state: string | null } | null;
  return {
    id,
    email: full ? email : maskEmail(email),
    name: p?.full_name ?? null,
    stage: stageLabel(u.career_stage),
    markets: marketsLabel(u.target_markets ?? []),
    joined: u.created_at,
    setup: Boolean(u.setup_completed_at),
    plan: planFor(myPasses, (usage.data as Usage | null) ?? undefined, (free.data as Free | null) ?? undefined),
    paidKobo: paidTotal(myPasses),
    activeDays30: acts.length,
    lastActive: acts.map((a) => a.last_at).sort().at(-1) ?? null,
    suspended: Boolean(u.suspended_at),
    // Contact details only for the owner view.
    phone: full ? (p?.phone ?? null) : null,
    place: [p?.city, p?.state].filter(Boolean).join(", ") || null,
    provider: u.auth_provider ?? "email",
    lastSignIn: auth.data?.user?.last_sign_in_at ?? null,
    suspendedReason: (u.suspended_reason as string | null) ?? null,
    isStaff: Boolean(staffRow.data),
    visits30: acts.reduce((n, a) => n + a.views, 0),
    activeDays7: acts.filter((a) => a.day >= since7).length,
    activity: last30(acts),
    counts: { roles: roles.count ?? 0, items: items.count ?? 0, confirmedItems: confirmed.count ?? 0, cvs: cvs.count ?? 0, applications: apps.count ?? 0, interviews: interviews.count ?? 0, offers: offers.count ?? 0 },
    payments: myPasses.filter((x) => x.type !== "trial_3d").map((x) => ({ id: x.id, product: PRODUCT[x.type] ?? x.type, amountKobo: x.amount_kobo, status: x.status, reference: x.paystack_reference, created: x.created_at, endsAt: x.ends_at })),
    freeAccess: free.data ? { until: (free.data as Free).ends_at, note: (free.data as Free).note } : null,
  };
}
