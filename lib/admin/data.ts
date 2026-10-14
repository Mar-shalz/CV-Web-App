import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS } from "@/lib/config";
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
/** `how` says in plain words what is counted, for anyone reading the card. */
export type Kpi = { label: string; value: string; target: string; status: KpiStatus; note: string; how: string };
export type Gate = { name: string; state: "passed" | "in_progress" | "not_started"; checks: { text: string; ok: boolean | null }[] };
export type Overview = {
  kpis: Kpi[];
  gates: Gate[];
  signups: { date: string; count: number }[];
  queue: { openReports: number; overdueReports: number; pendingPayments: number; listsDue: number; accounts: number; newThisWeek: number };
};

const SAMPLE_SIGNUPS = [12, 18, 9, 22, 31, 27, 19, 24, 40, 36, 28, 33, 45, 38].map((count, i) => ({ date: ago(13 - i), count }));

const HOW = {
  price: "Taps on the price on the landing page in the last 30 days. Each tap goes to sign in, so it shows how many people are ready to pay.",
  ready: "Of people who joined in the last 30 days (at least a day ago), the share who confirmed 5 or more achievements within 24 hours of joining.",
  pack: "Of the same people, the share whose first application pack (tailored CV plus the message to send) was ready within 24 hours of joining.",
  trial: "Of people whose 3 day trial started in the last 60 days, the share who then bought a pass.",
  invites: "Interview invites recorded in the last 30 days, divided by the people who sent at least one application in that time.",
  ai: "AI spend in the last 30 days divided by the people who used at least one AI step. Free tier calls count as $0.",
  flags: "Of CV lines our fact check flagged in CVs made in the last 30 days, the share the person fixed, removed or confirmed.",
  sent: "Applications people marked as sent in the last 30 days, and how many people sent them.",
} as const;

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "Not enough data");
const statusFor = (n: number, d: number, target: number): KpiStatus => (d < 5 ? "none" : n / d >= target ? "good" : n / d >= target * 0.75 ? "warn" : "bad");

export async function getOverview(staff: Staff): Promise<Overview> {
  if (staff.preview) {
    return {
      kpis: [
        { label: "Price button taps", value: "17", target: "3% of visitors", status: "good", note: "Last 30 days", how: HOW.price },
        { label: "Experience ready on day one", value: "54%", target: "50%", status: "good", note: "32 of 59 new people", how: HOW.ready },
        { label: "First pack within 24h", value: "38%", target: "40%", status: "warn", note: "22 of 59 new people", how: HOW.pack },
        { label: "Trial to pass", value: "6.2%", target: "8%", status: "warn", note: "9 of 145 trials", how: HOW.trial },
        { label: "Invites per active seeker", value: "0.7", target: "1 per 30 days", status: "warn", note: "North star", how: HOW.invites },
        { label: "AI cost per active user", value: "$0.31", target: `under $${LIMITS.ai.budget_usd_per_active_user_month}`, status: "good", note: "Last 30 days", how: HOW.ai },
        { label: "Flagged lines resolved", value: "93%", target: "95%", status: "warn", note: "Fixed, removed or confirmed", how: HOW.flags },
        { label: "Applications sent", value: "286", target: "Growing each week", status: "good", note: "By 131 people", how: HOW.sent },
      ],
      gates: [
        { name: "Gate 1: willingness to pay", state: "passed", checks: [{ text: "300 accounts", ok: true }, { text: "3% tap the price", ok: true }] },
        { name: "Gate 2: truth and data", state: "in_progress", checks: [{ text: "Zero invented facts on golden set G3", ok: null }, { text: "Under 1.5MB of data per session", ok: true }, { text: "First load under 300KB", ok: true }] },
        { name: "Gate 3: closed beta", state: "not_started", checks: [{ text: "70% find the verdict helpful", ok: null }, { text: "8% trial to pass", ok: null }, { text: "8% of applications get an invite", ok: null }] },
      ],
      signups: SAMPLE_SIGNUPS,
      queue: { openReports: 3, overdueReports: 1, pendingPayments: 2, listsDue: 1, accounts: 412, newThisWeek: 64 },
    };
  }

  const db = createAdminClient();
  const since14 = ago(14);
  const since30 = ago(30);
  const [users, recent, reports, overdue, pending, clicks, cohort, trials, aiRows, invites, senders, cvs, week] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("users").select("created_at").gte("created_at", since14),
    db.from("truth_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("truth_reports").select("id", { count: "exact", head: true }).eq("status", "open").lt("created_at", ago(0, LIMITS.back_office.truth_report_sla_hours)),
    db.from("passes").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("price_clicks").select("visitor").gte("at", since30).limit(20000),
    db.from("users").select("id, created_at").gte("created_at", since30).lt("created_at", ago(1)).limit(2000),
    db.from("usage_counters").select("user_id").gte("trial_started_at", ago(60)).limit(5000),
    db.from("ai_call_logs").select("cost_usd, user_ref").gte("at", since30).limit(50000),
    db.from("outcome_events").select("user_id").in("to_status", ["interview", "second_interview", "assessment"]).gte("created_at", since30).limit(20000),
    db.from("applications").select("user_id").gte("sent_at", since30).limit(20000),
    db.from("cv_versions").select("content").gte("created_at", since30).limit(1000),
    db.from("users").select("id", { count: "exact", head: true }).gte("created_at", ago(7)),
  ]);

  // Day one readiness and first pack for people who joined in the last 30 days.
  const people = (cohort.data ?? []) as { id: string; created_at: string }[];
  const ids = people.map((p) => p.id);
  const joined = new Map(people.map((p) => [p.id, new Date(p.created_at).getTime()]));
  const [items, packs] = ids.length
    ? await Promise.all([
        db.from("vault_items").select("user_id, confirmed_at").in("user_id", ids).not("confirmed_at", "is", null).limit(50000),
        db.from("application_packs").select("user_id, created_at").in("user_id", ids).limit(20000),
      ])
    : [{ data: [] }, { data: [] }];
  const within = (uid: string, at: string) => new Date(at).getTime() - (joined.get(uid) ?? 0) <= DAY;
  const earlyItems = new Map<string, number>();
  for (const i of (items.data ?? []) as { user_id: string; confirmed_at: string }[]) if (within(i.user_id, i.confirmed_at)) earlyItems.set(i.user_id, (earlyItems.get(i.user_id) ?? 0) + 1);
  const readyDayOne = [...earlyItems.values()].filter((n) => n >= LIMITS.onboarding.vault_ready_items).length;
  const fastPack = new Set(((packs.data ?? []) as { user_id: string; created_at: string }[]).filter((p) => within(p.user_id, p.created_at)).map((p) => p.user_id)).size;

  // Trial to pass.
  const trialIds = ((trials.data ?? []) as { user_id: string }[]).map((t) => t.user_id);
  const { data: paid } = trialIds.length ? await db.from("passes").select("user_id").in("user_id", trialIds).eq("type", "job_hunt_30d").in("status", ["active", "expired"]) : { data: [] };
  const converted = new Set((paid ?? []).map((p) => p.user_id)).size;

  // Invites per active seeker, AI cost per active user.
  const seekers = new Set(((senders.data ?? []) as { user_id: string }[]).map((a) => a.user_id)).size;
  const inviteCount = (invites.data ?? []).length;
  const ai = (aiRows.data ?? []) as { cost_usd: number; user_ref: string | null }[];
  const aiUsers = new Set(ai.map((r) => r.user_ref).filter(Boolean)).size;
  const aiTotal = ai.reduce((n, r) => n + Number(r.cost_usd), 0);

  // Flagged lines resolved: flags on CV lines, by status.
  let flagged = 0;
  let resolved = 0;
  for (const c of (cvs.data ?? []) as { content: { sections?: { kind?: string; roles?: { bullets?: { flags?: { status?: string }[] }[] }[] }[] } | null }[]) {
    for (const sec of c.content?.sections ?? []) for (const r of sec.roles ?? []) for (const b of r.bullets ?? []) for (const f of b.flags ?? []) {
      flagged++;
      if (f.status && f.status !== "open") resolved++;
    }
  }

  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) byDay.set(ago(i).slice(0, 10), 0);
  for (const r of recent.data ?? []) {
    const k = String(r.created_at).slice(0, 10);
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const accounts = users.count ?? 0;
  const taps = new Set(((clicks.data ?? []) as { visitor: string | null }[]).map((c, i) => c.visitor ?? `anon-${i}`)).size;
  const budget = LIMITS.ai.budget_usd_per_active_user_month;
  const perUser = aiUsers ? aiTotal / aiUsers : 0;
  return {
    kpis: [
      { label: "Price button taps", value: taps.toLocaleString("en-NG"), target: "3% of visitors", status: taps ? "good" : "none", note: clicks.error ? "Shows once the latest database update runs" : "Last 30 days, one per browser", how: HOW.price },
      { label: "Experience ready on day one", value: pct(readyDayOne, people.length), target: "50%", status: statusFor(readyDayOne, people.length, 0.5), note: `${readyDayOne} of ${people.length} new people`, how: HOW.ready },
      { label: "First pack within 24h", value: pct(fastPack, people.length), target: "40%", status: statusFor(fastPack, people.length, 0.4), note: `${fastPack} of ${people.length} new people`, how: HOW.pack },
      { label: "Trial to pass", value: pct(converted, trialIds.length), target: "8%", status: statusFor(converted, trialIds.length, 0.08), note: `${converted} of ${trialIds.length} trials`, how: HOW.trial },
      { label: "Invites per active seeker", value: seekers ? (inviteCount / seekers).toFixed(1) : "Not enough data", target: "1 per 30 days", status: seekers < 5 ? "none" : inviteCount / seekers >= 1 ? "good" : "warn", note: `${inviteCount} invites, ${seekers} people applying`, how: HOW.invites },
      { label: "AI cost per active user", value: aiUsers ? `$${perUser.toFixed(2)}` : "Not enough data", target: `under $${budget}`, status: aiUsers ? (perUser <= budget ? "good" : "bad") : "none", note: `$${aiTotal.toFixed(2)} across ${aiUsers} people`, how: HOW.ai },
      { label: "Flagged lines resolved", value: pct(resolved, flagged), target: "95%", status: statusFor(resolved, flagged, 0.95), note: `${resolved} of ${flagged} flagged lines`, how: HOW.flags },
      { label: "Applications sent", value: (senders.data ?? []).length.toLocaleString("en-NG"), target: "Growing each week", status: (senders.data ?? []).length ? "good" : "none", note: `By ${seekers} ${seekers === 1 ? "person" : "people"}`, how: HOW.sent },
    ],
    gates: [
      { name: "Gate 1: willingness to pay", state: accounts >= 300 ? "passed" : "in_progress", checks: [{ text: "300 accounts", ok: accounts >= 300 }, { text: "3% tap the price", ok: null }] },
      { name: "Gate 2: truth and data", state: "in_progress", checks: [{ text: "Zero invented facts on golden set G3", ok: null }, { text: "First load under 300KB", ok: true }] },
      { name: "Gate 3: closed beta", state: "not_started", checks: [{ text: "70% find the verdict helpful", ok: null }, { text: "8% trial to pass", ok: trialIds.length >= 20 ? converted / trialIds.length >= 0.08 : null }] },
    ],
    signups: [...byDay].map(([date, count]) => ({ date, count })),
    queue: { openReports: reports.count ?? 0, overdueReports: overdue.count ?? 0, pendingPayments: pending.count ?? 0, listsDue: 0, accounts, newThisWeek: week.count ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Users and waitlist
// ---------------------------------------------------------------------------
export type WaitlistData = { total: number; bySource: { source: string; count: number }[]; rows: { email: string; source: string; joined: string }[] };

export async function getWaitlist(staff: Staff, full = false): Promise<WaitlistData> {
  const show = (email: string | null | undefined) => (full ? (email ?? "Unknown") : maskEmail(email));
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
        { email: show("bisi.o@gmail.com"), source: "Price button", joined: ago(0, 1) },
        { email: show("emeka.n@gmail.com"), source: "Job group links", joined: ago(0, 6) },
        { email: show("zainab.m@yahoo.com"), source: "Landing page footer", joined: ago(1) },
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
    rows: (data ?? []).slice(0, 50).map((r) => ({ email: show(r.email), source: r.source ?? "unknown", joined: r.created_at })),
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export type PaymentRow = { id: string; userId: string; email: string; reference: string; product: string; amountKobo: number; status: string; created: string };

/** Payments, newest first, with who paid. Full emails only for the owner ("users.manage"). */
export async function listPayments(staff: Staff, full = false): Promise<PaymentRow[]> {
  const show = (email: string | null | undefined) => (full ? (email ?? "Unknown") : maskEmail(email));
  if (staff.preview) {
    return [
      { id: "p1", userId: "u1", email: show("tolu.adebayo@gmail.com"), reference: "PSK_7f3a91", product: "job_hunt_30d", amountKobo: 500000, status: "active", created: ago(0, 2) },
      { id: "p2", userId: "u2", email: show("chidi.okafor@yahoo.com"), reference: "PSK_2c8b44", product: "job_hunt_30d", amountKobo: 500000, status: "pending", created: ago(0, 1) },
      { id: "p3", userId: "u1", email: show("tolu.adebayo@gmail.com"), reference: "PSK_91d0e2", product: "interview_boost", amountKobo: 150000, status: "active", created: ago(1) },
      { id: "p4", userId: "u4", email: show("ife.bello@gmail.com"), reference: "PSK_5e61aa", product: "job_hunt_30d", amountKobo: 500000, status: "pending", created: ago(1, 4) },
      { id: "p5", userId: "u5", email: show("kunle.ade@gmail.com"), reference: "PSK_c0ffee", product: "job_hunt_30d", amountKobo: 500000, status: "refunded", created: ago(6) },
      { id: "p6", userId: "u3", email: show("amaka.eze@outlook.com"), reference: "PSK_0a0b1c", product: "job_hunt_30d", amountKobo: 500000, status: "failed", created: ago(7) },
    ];
  }
  const db = createAdminClient();
  const { data } = await db.from("passes").select("id, user_id, paystack_reference, type, amount_kobo, status, created_at, users(email)").neq("type", "trial_3d").order("created_at", { ascending: false }).limit(100);
  return (data ?? []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    email: show((p.users as unknown as { email: string } | null)?.email),
    reference: p.paystack_reference ?? "None",
    product: p.type,
    amountKobo: p.amount_kobo,
    status: p.status,
    created: p.created_at,
  }));
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
export type AiProviderStatus = { name: string; ready: boolean; position: number | null };
export type AiProblem = { at: string; task: string; model: string; outcome: string };
export type AiData = { rows: AiTaskRow[]; totalUsd: number; activeUsers: number; perActiveUsd: number; budgetUsd: number; providers: AiProviderStatus[]; problems: AiProblem[] };

/** Which AI keys this server has (never the keys themselves), in the order they're tried. */
function providerStatus(): AiProviderStatus[] {
  const order = (process.env.AI_PROVIDERS || "gemini,anthropic").split(",").map((p) => p.trim());
  const ready = { gemini: Boolean(process.env.GEMINI_API_KEY), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) };
  const live = order.filter((p) => ready[p as keyof typeof ready]);
  return [
    { name: "Google Gemini", ready: ready.gemini, position: live.includes("gemini") ? live.indexOf("gemini") + 1 : null },
    { name: "Anthropic Claude", ready: ready.anthropic, position: live.includes("anthropic") ? live.indexOf("anthropic") + 1 : null },
  ];
}

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
    return { rows, totalUsd, activeUsers: 430, perActiveUsd: totalUsd / 430, budgetUsd, providers: providerStatus(), problems: [{ at: ago(0, 2), task: "parse_cv", model: "gemini-3.8-flash", outcome: "provider_error" }] };
  }
  const db = createAdminClient();
  const [{ data }, { data: bad }] = await Promise.all([
    db.from("ai_call_logs").select("task, model, outcome, latency_ms, cost_usd, user_ref").gte("at", ago(30)).limit(50000),
    db.from("ai_call_logs").select("at, task, model, outcome").not("outcome", "in", "(ok,cache_hit)").order("at", { ascending: false }).limit(12),
  ]);
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
  return { rows, totalUsd, activeUsers: users.size, perActiveUsd: users.size ? totalUsd / users.size : 0, budgetUsd, providers: providerStatus(), problems: (bad ?? []) as AiProblem[] };
}

// ---------------------------------------------------------------------------
// Audit log and team
// ---------------------------------------------------------------------------
export type AuditKind = "actions" | "views" | "sign_ins";
export type AuditRow = { id: string; at: string; who: string; whoEmail: string | null; role: string | null; action: string; target: string | null };

// Plain words for each logged action. Views of personal data are logged too (Build pack),
// but the log shows what staff did unless "Views" is chosen.
export const AUDIT_ACTIONS: Record<string, string> = {
  suspend: "Paused an account",
  restore: "Restored an account",
  delete_account: "Deleted an account",
  grant_free_access: "Gave free access",
  revoke_free_access: "Removed free access",
  refund: "Recorded a refund",
  add_member: "Added to the team",
  pause_member: "Paused team access",
  reactivate_member: "Reactivated team access",
  delete_member: "Deleted from the team",
  revoke_member: "Removed from the team",
  message_person: "Sent a message",
  announce: "Posted an announcement",
  end_announcement: "Ended an announcement",
  recall_message: "Recalled a message",
  save_draft: "Saved a message draft",
  delete_draft: "Deleted a message draft",
  resolve: "Fixed a truth report",
  dismiss: "Dismissed a truth report",
  publish: "Published rules",
  mfa_verified: "Signed in with two factor",
  view: "Viewed",
};

const VIEW_OF: Record<string, string> = { users: "users", passes: "payments", waitlist: "the waitlist", truth_reports: "truth reports", announcements: "messages" };

export async function listAudit(staff: Staff, kind: AuditKind = "actions"): Promise<AuditRow[]> {
  if (staff.preview) {
    const rows: (AuditRow & { kind: AuditKind })[] = [
      { id: "a1", at: ago(0, 1), who: "Tolu Adebayo", whoEmail: "founder@example.test", role: "owner", action: "Paused an account", target: "kunle.ade@gmail.com", kind: "actions" },
      { id: "a2", at: ago(0, 2), who: "Tolu Adebayo", whoEmail: "founder@example.test", role: "owner", action: "Gave free access", target: "amaka.eze@outlook.com", kind: "actions" },
      { id: "a3", at: ago(0, 3), who: "Finance", whoEmail: "finance@example.test", role: "finance", action: "Recorded a refund", target: "PSK_c0ffee", kind: "actions" },
      { id: "a4", at: ago(1), who: "Chidi Okafor", whoEmail: "reviewer@example.test", role: "reviewer", action: "Fixed a truth report", target: null, kind: "actions" },
      { id: "a5", at: ago(2), who: "Tolu Adebayo", whoEmail: "founder@example.test", role: "owner", action: "Published rules", target: "eligibility_v0.3", kind: "actions" },
      { id: "a6", at: ago(0, 1), who: "Tolu Adebayo", whoEmail: "founder@example.test", role: "owner", action: "Viewed users", target: null, kind: "views" },
      { id: "a7", at: ago(0, 4), who: "Tolu Adebayo", whoEmail: "founder@example.test", role: "owner", action: "Signed in with two factor", target: null, kind: "sign_ins" },
    ];
    return rows.filter((r) => r.kind === kind);
  }
  const db = createAdminClient();
  let query = db.from("audit_log").select("id, at, actor, actor_role, action, entity, entity_id").order("at", { ascending: false }).limit(200);
  query = kind === "views" ? query.eq("action", "view") : kind === "sign_ins" ? query.eq("action", "mfa_verified") : query.not("action", "in", "(view,mfa_verified)");
  const { data } = await query;
  const rows = data ?? [];

  // Who: the staff member's name and email. What: the person or thing acted on.
  const actorIds = [...new Set(rows.map((r) => r.actor as string).filter(Boolean))];
  const userTargets = [...new Set(rows.filter((r) => (r.entity === "users" || r.entity === "admin_members" || r.entity === "notifications") && r.entity_id).map((r) => r.entity_id as string))];
  const freeIds = rows.filter((r) => r.entity === "free_access" && r.entity_id).map((r) => r.entity_id as string);
  const passIds = rows.filter((r) => r.entity === "passes" && r.entity_id).map((r) => r.entity_id as string);
  const people = [...new Set([...actorIds, ...userTargets])].filter((id) => /^[0-9a-f-]{36}$/.test(id));
  const [users, names, frees, passes] = await Promise.all([
    people.length ? db.from("users").select("id, email").in("id", people) : Promise.resolve({ data: [] }),
    actorIds.length ? db.from("profiles").select("user_id, full_name").in("user_id", actorIds) : Promise.resolve({ data: [] }),
    freeIds.length ? db.from("free_access").select("id, email").in("id", freeIds) : Promise.resolve({ data: [] }),
    passIds.length ? db.from("passes").select("id, paystack_reference").in("id", passIds) : Promise.resolve({ data: [] }),
  ]);
  const emailOf = new Map(((users.data ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email]));
  const nameOf = new Map(((names.data ?? []) as { user_id: string; full_name: string | null }[]).map((n) => [n.user_id, n.full_name]));
  const freeOf = new Map(((frees.data ?? []) as { id: string; email: string }[]).map((f) => [f.id, f.email]));
  const passOf = new Map(((passes.data ?? []) as { id: string; paystack_reference: string | null }[]).map((p) => [p.id, p.paystack_reference]));

  return rows.map((r) => {
    const id = r.entity_id as string | null;
    const target =
      r.entity === "users" || r.entity === "admin_members" || r.entity === "notifications"
        ? id
          ? (emailOf.get(id) ?? (r.action === "delete_account" ? "Account now deleted" : "Account no longer exists"))
          : null
        : r.entity === "free_access"
          ? (id && freeOf.get(id)) || null
          : r.entity === "passes"
            ? (id && passOf.get(id)) || null
            : r.action === "publish"
              ? id
              : null;
    const actor = r.actor as string;
    return {
      id: String(r.id),
      at: r.at,
      who: nameOf.get(actor) || emailOf.get(actor) || "Former staff member",
      whoEmail: emailOf.get(actor) ?? null,
      role: r.actor_role,
      action: r.action === "view" ? `Viewed ${VIEW_OF[r.entity] ?? r.entity}` : (AUDIT_ACTIONS[r.action] ?? r.action.replace(/_/g, " ")),
      target,
    };
  });
}

export type TeamRow = { userId: string; email: string; name: string | null; role: string; added: string; status: "active" | "paused" | "removed" };

/** The team. Team and access is owner only, so emails are shown in full. */
export async function listTeam(staff: Staff): Promise<TeamRow[]> {
  if (staff.preview) {
    return [
      { userId: "t1", email: "founder@example.test", name: "Tolu Adebayo", role: "owner", added: ago(30), status: "active" },
      { userId: "t2", email: "reviewer@example.test", name: "Chidi Okafor", role: "reviewer", added: ago(12), status: "active" },
      { userId: "t3", email: "support@example.test", name: null, role: "support", added: ago(5), status: "paused" },
    ];
  }
  const db = createAdminClient();
  const { data } = await db.from("admin_members").select("*, users(email)").order("created_at");
  const ids = (data ?? []).map((m) => m.user_id as string);
  const { data: names } = ids.length ? await db.from("profiles").select("user_id, full_name").in("user_id", ids) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.user_id as string, n.full_name as string | null]));
  return (data ?? []).map((m) => {
    const u = m.users as unknown as { email: string } | null;
    return {
      userId: m.user_id,
      email: u?.email ?? "Unknown",
      name: nameOf.get(m.user_id) ?? null,
      role: m.role,
      added: m.created_at,
      status: m.revoked_at ? "removed" : m.paused_at ? "paused" : "active",
    };
  });
}
