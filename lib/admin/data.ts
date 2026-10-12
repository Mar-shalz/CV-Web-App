import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, MARKETS } from "@/lib/config";
import banned from "@/config/lists/banned_phrases.json";
import { maskEmail } from "./permissions";
import type { Staff } from "./auth";

// Back office reads. Preview mode returns sample data (fictional people); otherwise
// the service role client reads the database. Lists never return raw emails.

const DAY = 86400000;
const ago = (d: number, h = 0) => new Date(Date.now() - d * DAY - h * 3600000).toISOString();

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export type KpiStatus = "good" | "warn" | "bad" | "none";
export type Kpi = { label: string; value: string; target: string; status: KpiStatus; note: string };
export type Gate = { name: string; state: "passed" | "in_progress" | "not_started"; checks: { text: string; ok: boolean | null }[] };
export type Overview = {
  kpis: Kpi[];
  gates: Gate[];
  signups: { date: string; count: number }[];
  queue: { openReports: number; overdueReports: number; pendingPayments: number; listsDue: number };
};

const SAMPLE_SIGNUPS = [12, 18, 9, 22, 31, 27, 19, 24, 40, 36, 28, 33, 45, 38].map((count, i) => ({ date: ago(13 - i), count }));

export async function getOverview(staff: Staff): Promise<Overview> {
  if (staff.preview) {
    return {
      kpis: [
        { label: "Waitlist", value: "412", target: "300 for Gate 1", status: "good", note: "Gate 1 target met" },
        { label: "Price button clicks", value: "4.1%", target: "3% or more", status: "good", note: "17 of 412 visitors" },
        { label: "Vault ready on day one", value: "54%", target: "50%", status: "good", note: "5 confirmed items in session one" },
        { label: "First pack within 24h", value: "38%", target: "40%", status: "warn", note: "2 points under target" },
        { label: "Trial to pass", value: "6.2%", target: "8%", status: "warn", note: "Beta target" },
        { label: "Invites per active seeker", value: "0.7", target: "1 per 30 days", status: "warn", note: "North star" },
        { label: "AI cost per active user", value: "$0.31", target: `under $${LIMITS.ai.budget_usd_per_active_user_month}`, status: "good", note: "Last 30 days" },
        { label: "Flagged lines resolved", value: "93%", target: "95%", status: "warn", note: "Fixed or removed before download" },
      ],
      gates: [
        { name: "Gate 1: willingness to pay", state: "passed", checks: [{ text: "300 waitlist sign ups", ok: true }, { text: "3% click the price button", ok: true }] },
        {
          name: "Gate 2: truth and data",
          state: "in_progress",
          checks: [
            { text: "Zero invented facts on golden set G3", ok: null },
            { text: "Under 1.5MB of data per session", ok: true },
            { text: "First load under 300KB", ok: true },
          ],
        },
        { name: "Gate 3: closed beta", state: "not_started", checks: [{ text: "70% find the verdict helpful", ok: null }, { text: "8% trial to pass", ok: null }, { text: "8% of applications get an invite", ok: null }] },
      ],
      signups: SAMPLE_SIGNUPS,
      queue: { openReports: 3, overdueReports: 1, pendingPayments: 2, listsDue: 1 },
    };
  }

  const db = createAdminClient();
  const since14 = ago(14);
  const [waitlist, users, recent, reports, overdue, pending] = await Promise.all([
    db.from("waitlist").select("id", { count: "exact", head: true }),
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("users").select("created_at").gte("created_at", since14),
    db.from("truth_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("truth_reports").select("id", { count: "exact", head: true }).eq("status", "open").lt("created_at", ago(0, LIMITS.back_office.truth_report_sla_hours)),
    db.from("passes").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) byDay.set(ago(i).slice(0, 10), 0);
  for (const r of recent.data ?? []) {
    const k = String(r.created_at).slice(0, 10);
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const wl = waitlist.count ?? 0;
  const none = (label: string, target: string): Kpi => ({ label, value: "Not enough data", target, status: "none", note: "Fills in during the beta" });
  return {
    kpis: [
      { label: "Waitlist", value: wl.toLocaleString("en-NG"), target: "300 for Gate 1", status: wl >= 300 ? "good" : "warn", note: `${users.count ?? 0} accounts created` },
      none("Price button clicks", "3% or more"),
      none("Vault ready on day one", "50%"),
      none("First pack within 24h", "40%"),
      none("Trial to pass", "8%"),
      none("Invites per active seeker", "1 per 30 days"),
      none("AI cost per active user", `under $${LIMITS.ai.budget_usd_per_active_user_month}`),
      none("Flagged lines resolved", "95%"),
    ],
    gates: [
      { name: "Gate 1: willingness to pay", state: "in_progress", checks: [{ text: "300 waitlist sign ups", ok: wl >= 300 }, { text: "3% click the price button", ok: null }] },
      { name: "Gate 2: truth and data", state: "in_progress", checks: [{ text: "Zero invented facts on golden set G3", ok: null }, { text: "First load under 300KB", ok: true }] },
      { name: "Gate 3: closed beta", state: "not_started", checks: [{ text: "70% find the verdict helpful", ok: null }, { text: "8% trial to pass", ok: null }] },
    ],
    signups: [...byDay].map(([date, count]) => ({ date, count })),
    queue: { openReports: reports.count ?? 0, overdueReports: overdue.count ?? 0, pendingPayments: pending.count ?? 0, listsDue: 0 },
  };
}

// ---------------------------------------------------------------------------
// Users and waitlist
// ---------------------------------------------------------------------------
export type UserRow = { id: string; email: string; stage: string; markets: string; joined: string; setup: boolean };

const stageLabel = (id: string | null) => MARKETS.career_stages.find((s) => s.id === id)?.label ?? "Not set";
const marketLabel = (codes: string[] | null) => (codes ?? []).map((c) => MARKETS.countries.find((x) => x.code === c)?.label ?? c).join(", ") || "Not set";

export async function listUsers(staff: Staff, q?: string): Promise<UserRow[]> {
  if (staff.preview) {
    const sample: UserRow[] = [
      { id: "u1", email: maskEmail("tolu.adebayo@gmail.com"), stage: stageLabel("nysc"), markets: marketLabel(["NG", "GB"]), joined: ago(0, 3), setup: true },
      { id: "u2", email: maskEmail("chidi.okafor@yahoo.com"), stage: stageLabel("graduate_0_3"), markets: marketLabel(["NG"]), joined: ago(1), setup: true },
      { id: "u3", email: maskEmail("amaka.eze@outlook.com"), stage: stageLabel("experienced_3_plus"), markets: marketLabel(["GB", "CA"]), joined: ago(2), setup: true },
      { id: "u4", email: maskEmail("ife.bello@gmail.com"), stage: stageLabel(null), markets: marketLabel(null), joined: ago(2, 5), setup: false },
      { id: "u5", email: maskEmail("kunle.ade@gmail.com"), stage: stageLabel("final_year"), markets: marketLabel(["NG"]), joined: ago(4), setup: true },
    ];
    return q ? sample.filter((u) => u.email.startsWith(q.slice(0, 2).toLowerCase())) : sample;
  }
  const db = createAdminClient();
  let query = db.from("users").select("id, email, career_stage, target_markets, created_at, setup_completed_at").order("created_at", { ascending: false }).limit(50);
  if (q) query = query.ilike("email", `${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  return (data ?? []).map((u) => ({
    id: u.id,
    email: maskEmail(u.email),
    stage: stageLabel(u.career_stage),
    markets: marketLabel(u.target_markets),
    joined: u.created_at,
    setup: Boolean(u.setup_completed_at),
  }));
}

export type WaitlistData = { total: number; bySource: { source: string; count: number }[]; rows: { email: string; source: string; joined: string }[] };

export async function getWaitlist(staff: Staff): Promise<WaitlistData> {
  if (staff.preview) {
    return {
      total: 412,
      bySource: [
        { source: "Job group links", count: 211 },
        { source: "Landing page footer", count: 96 },
        { source: "Price button", count: 17 },
        { source: "Campus talks", count: 88 },
      ],
      rows: [
        { email: maskEmail("bisi.o@gmail.com"), source: "Price button", joined: ago(0, 1) },
        { email: maskEmail("emeka.n@gmail.com"), source: "Job group links", joined: ago(0, 6) },
        { email: maskEmail("zainab.m@yahoo.com"), source: "Landing page footer", joined: ago(1) },
      ],
    };
  }
  const db = createAdminClient();
  const [{ count }, { data }] = await Promise.all([
    db.from("waitlist").select("id", { count: "exact", head: true }),
    db.from("waitlist").select("email, source, created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const by = new Map<string, number>();
  for (const r of data ?? []) by.set(r.source ?? "unknown", (by.get(r.source ?? "unknown") ?? 0) + 1);
  return {
    total: count ?? 0,
    bySource: [...by].map(([source, c]) => ({ source, count: c })).sort((a, b) => b.count - a.count),
    rows: (data ?? []).slice(0, 50).map((r) => ({ email: maskEmail(r.email), source: r.source ?? "unknown", joined: r.created_at })),
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export type PaymentRow = { id: string; reference: string; product: string; amountKobo: number; status: string; created: string };

export async function listPayments(staff: Staff): Promise<PaymentRow[]> {
  if (staff.preview) {
    return [
      { id: "p1", reference: "PSK_7f3a91", product: "job_hunt_30d", amountKobo: 500000, status: "active", created: ago(0, 2) },
      { id: "p2", reference: "PSK_2c8b44", product: "job_hunt_30d", amountKobo: 500000, status: "pending", created: ago(0, 1) },
      { id: "p3", reference: "PSK_91d0e2", product: "interview_boost", amountKobo: 150000, status: "active", created: ago(1) },
      { id: "p4", reference: "PSK_5e61aa", product: "job_hunt_30d", amountKobo: 500000, status: "pending", created: ago(1, 4) },
      { id: "p5", reference: "PSK_c0ffee", product: "job_hunt_30d", amountKobo: 500000, status: "refunded", created: ago(6) },
      { id: "p6", reference: "PSK_0a0b1c", product: "job_hunt_30d", amountKobo: 500000, status: "failed", created: ago(7) },
    ];
  }
  const db = createAdminClient();
  const { data } = await db.from("passes").select("id, paystack_reference, type, amount_kobo, status, created_at").neq("type", "trial_3d").order("created_at", { ascending: false }).limit(100);
  return (data ?? []).map((p) => ({ id: p.id, reference: p.paystack_reference ?? "None", product: p.type, amountKobo: p.amount_kobo, status: p.status, created: p.created_at }));
}

// ---------------------------------------------------------------------------
// Reviews: truth reports and the weekly CV sample
// ---------------------------------------------------------------------------
export type ReportRow = { id: string; created: string; reason: string; status: string; bullet: string | null; ageHours: number };
export type ReviewData = { reports: ReportRow[]; sample: { id: string; created: string; format: string }[] };

export async function getReviews(staff: Staff): Promise<ReviewData> {
  const age = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (staff.preview) {
    return {
      reports: [
        { id: "r1", created: ago(2, 3), reason: "I never led the records project. I only helped.", status: "open", bullet: "b2", ageHours: 51 },
        { id: "r2", created: ago(0, 9), reason: "The 20% figure is not mine.", status: "open", bullet: "b4", ageHours: 9 },
        { id: "r3", created: ago(0, 2), reason: "Wrong graduation year on the CV.", status: "open", bullet: null, ageHours: 2 },
      ],
      sample: Array.from({ length: 6 }, (_, i) => ({ id: `cv${i + 1}`, created: ago(i + 1), format: i % 3 === 0 ? "UK" : "Nigerian graduate programme" })),
    };
  }
  const db = createAdminClient();
  const [{ data: reports }, { data: cvs }] = await Promise.all([
    db.from("truth_reports").select("id, created_at, reason, status, bullet_id").eq("status", "open").order("created_at").limit(50),
    db.from("cv_versions").select("id, created_at, format_profile").gte("created_at", ago(7)).limit(500),
  ]);
  // Random sample of the week's CVs, by id only. Content opens one at a time, and each open is audited.
  const shuffled = [...(cvs ?? [])].sort(() => Math.random() - 0.5).slice(0, LIMITS.back_office.weekly_cv_sample);
  return {
    reports: (reports ?? []).map((r) => ({ id: r.id, created: r.created_at, reason: r.reason ?? "", status: r.status, bullet: r.bullet_id, ageHours: age(r.created_at) })),
    sample: shuffled.map((c) => ({ id: c.id, created: c.created_at, format: c.format_profile })),
  };
}

// ---------------------------------------------------------------------------
// Rules and lists
// ---------------------------------------------------------------------------
export type RuleRow = { kind: string; version: string; reviewedBy: string | null; reviewedAt: string | null; publishedAt: string | null };
export type ListRow = { name: string; file: string; version: string | null; items: number | null; nextReview: string | null };

export async function getRules(staff: Staff): Promise<{ rules: RuleRow[]; lists: ListRow[] }> {
  const reviewDue = (version: string) => new Date(new Date(version).getTime() + LIMITS.back_office.list_review_days * DAY).toISOString();
  const lists: ListRow[] = [
    { name: "Banned phrases", file: "config/lists/banned_phrases.json", version: banned.version, items: banned.phrases.length, nextReview: reviewDue(banned.version) },
    { name: "Free email domains", file: "config/lists/free_email_domains.json", version: null, items: null, nextReview: null },
    { name: "Government agencies and official portals", file: "config/lists/government_agencies.json", version: null, items: null, nextReview: null },
    { name: "Pay thresholds by title", file: "config/lists/pay_thresholds.json", version: null, items: null, nextReview: null },
  ];
  if (staff.preview) {
    return {
      rules: [
        { kind: "Eligibility rules", version: "eligibility_v0.3", reviewedBy: "Reviewer", reviewedAt: ago(3), publishedAt: ago(2) },
        { kind: "Eligibility rules", version: "eligibility_v0.4", reviewedBy: null, reviewedAt: null, publishedAt: null },
        { kind: "Country profile", version: "ng_graduate_v1", reviewedBy: "Reviewer", reviewedAt: ago(9), publishedAt: ago(8) },
        { kind: "Country profile", version: "uk_v1", reviewedBy: "Reviewer", reviewedAt: ago(9), publishedAt: null },
      ],
      lists,
    };
  }
  const db = createAdminClient();
  const [{ data: rs }, { data: cp }] = await Promise.all([
    db.from("rule_sets").select("version, reviewed_by, reviewed_at, published_at"),
    db.from("country_profiles").select("version, reviewed_by, reviewed_at, published_at"),
  ]);
  const map = (kind: string) => (r: { version: string; reviewed_by: string | null; reviewed_at: string | null; published_at: string | null }) => ({
    kind,
    version: r.version,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    publishedAt: r.published_at,
  });
  return { rules: [...(rs ?? []).map(map("Eligibility rules")), ...(cp ?? []).map(map("Country profile"))], lists };
}

// ---------------------------------------------------------------------------
// AI cost and quality
// ---------------------------------------------------------------------------
export type AiTaskRow = { task: string; model: string; calls: number; failed: number; avgLatencyMs: number; costUsd: number };
export type AiData = { rows: AiTaskRow[]; totalUsd: number; activeUsers: number; perActiveUsd: number; budgetUsd: number };

export async function getAi(staff: Staff): Promise<AiData> {
  const budgetUsd = LIMITS.ai.budget_usd_per_active_user_month;
  if (staff.preview) {
    const rows: AiTaskRow[] = [
      { task: "parse_job", model: "claude-haiku-5-5", calls: 1840, failed: 21, avgLatencyMs: 2100, costUsd: 9.2 },
      { task: "fit_verdict", model: "claude-sonnet-5-5", calls: 1215, failed: 9, avgLatencyMs: 6400, costUsd: 41.3 },
      { task: "tailor_cv", model: "claude-sonnet-5-5", calls: 690, failed: 14, avgLatencyMs: 14800, costUsd: 58.7 },
      { task: "legitimacy_lookup", model: "claude-sonnet-5-5", calls: 402, failed: 6, avgLatencyMs: 8800, costUsd: 22.1 },
      { task: "build_pack", model: "claude-haiku-5-5", calls: 655, failed: 2, avgLatencyMs: 1700, costUsd: 2.4 },
    ];
    const totalUsd = rows.reduce((s, r) => s + r.costUsd, 0);
    return { rows, totalUsd, activeUsers: 430, perActiveUsd: totalUsd / 430, budgetUsd };
  }
  const db = createAdminClient();
  const { data } = await db.from("ai_call_logs").select("task, model, outcome, latency_ms, cost_usd, user_ref").gte("at", ago(30)).limit(50000);
  const by = new Map<string, AiTaskRow & { latencyTotal: number }>();
  const users = new Set<string>();
  for (const r of data ?? []) {
    if (r.user_ref) users.add(r.user_ref);
    const k = `${r.task}|${r.model}`;
    const row = by.get(k) ?? { task: r.task, model: r.model, calls: 0, failed: 0, avgLatencyMs: 0, costUsd: 0, latencyTotal: 0 };
    row.calls += 1;
    if (r.outcome !== "ok" && r.outcome !== "cache_hit") row.failed += 1;
    row.latencyTotal += r.latency_ms;
    row.costUsd += Number(r.cost_usd);
    by.set(k, row);
  }
  const rows = [...by.values()].map(({ latencyTotal, ...r }) => ({ ...r, avgLatencyMs: r.calls ? latencyTotal / r.calls : 0 }));
  const totalUsd = rows.reduce((s, r) => s + r.costUsd, 0);
  return { rows, totalUsd, activeUsers: users.size, perActiveUsd: users.size ? totalUsd / users.size : 0, budgetUsd };
}

// ---------------------------------------------------------------------------
// Audit log and team
// ---------------------------------------------------------------------------
export type AuditRow = { id: string; at: string; actor: string; role: string | null; action: string; entity: string; entityId: string | null };

export async function listAudit(staff: Staff, action?: string): Promise<AuditRow[]> {
  if (staff.preview) {
    const rows: AuditRow[] = [
      { id: "a1", at: ago(0, 1), actor: "Owner", role: "owner", action: "view", entity: "users", entityId: null },
      { id: "a2", at: ago(0, 3), actor: "Finance", role: "finance", action: "refund", entity: "passes", entityId: "PSK_c0ffee" },
      { id: "a3", at: ago(1), actor: "Reviewer", role: "reviewer", action: "resolve", entity: "truth_reports", entityId: "r0" },
      { id: "a4", at: ago(2), actor: "Owner", role: "owner", action: "publish", entity: "rule_sets", entityId: "eligibility_v0.3" },
      { id: "a5", at: ago(3), actor: "Owner", role: "owner", action: "add_member", entity: "admin_members", entityId: null },
    ];
    return action ? rows.filter((r) => r.action === action) : rows;
  }
  const db = createAdminClient();
  let query = db.from("audit_log").select("id, at, actor, actor_role, action, entity, entity_id").order("at", { ascending: false }).limit(200);
  if (action) query = query.eq("action", action);
  const { data } = await query;
  return (data ?? []).map((r) => ({ id: String(r.id), at: r.at, actor: `${String(r.actor).slice(0, 8)}…`, role: r.actor_role, action: r.action, entity: r.entity, entityId: r.entity_id }));
}

export type TeamRow = { userId: string; email: string; role: string; added: string; revoked: boolean };

export async function listTeam(staff: Staff): Promise<TeamRow[]> {
  if (staff.preview) {
    return [
      { userId: "t1", email: maskEmail("founder@example.test"), role: "owner", added: ago(30), revoked: false },
      { userId: "t2", email: maskEmail("reviewer@example.test"), role: "reviewer", added: ago(12), revoked: false },
      { userId: "t3", email: maskEmail("support@example.test"), role: "support", added: ago(5), revoked: false },
    ];
  }
  const db = createAdminClient();
  const { data } = await db.from("admin_members").select("user_id, role, created_at, revoked_at, users(email)").order("created_at");
  return (data ?? []).map((m) => {
    const u = m.users as unknown as { email: string } | null;
    return { userId: m.user_id, email: maskEmail(u?.email), role: m.role, added: m.created_at, revoked: Boolean(m.revoked_at) };
  });
}
