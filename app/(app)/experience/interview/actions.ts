"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { runTask } from "@/lib/ai";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { quoteIsFrom } from "@/lib/vault/quote";
import { extractMetrics } from "@/lib/vault/metrics";
import { draftItemSchema, OWNERSHIP, type DraftItem } from "@/lib/vault/schema";
import { getVault } from "@/lib/vault/data";

type Turn = { question: string; intent: string; answer: string; mode: "voice" | "text"; at: string };

export type InterviewStep = {
  sessionId: string;
  question: string;
  intent: string;
  turnCount: number;
  done: boolean;
};

export type AnswerResult =
  | { ok: true; drafts: DraftItem[]; followUp: string | null; next: InterviewStep }
  | { ok: false; error: string; notEnglish?: boolean };

const opening = (title: string | null, org: string | null) =>
  `Let's find the wins your CV forgot. Tell me about ${title ?? "this role"}${org ? ` at ${org}` : ""}. What did a normal week look like?`;

/** Starts (or resumes) the interview for one role. The first question is fixed, so it costs nothing. */
export async function startInterview(roleId: string): Promise<{ ok: true; step: InterviewStep } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const vault = await getVault(viewer);
  const role = vault.roles.find((r) => r.id === roleId);
  if (!role) return { ok: false, error: "Pick a role first." };
  const first = { question: opening(role.title, role.organisation), intent: "routine" };

  if (viewer.preview) return { ok: true, step: { sessionId: "preview", ...first, turnCount: 0, done: false } };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("interview_sessions")
    .select("id, turns, current_question")
    .eq("user_id", viewer.id)
    .eq("role_id", roleId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.current_question) {
    const cq = existing.current_question as { question: string; intent: string };
    return { ok: true, step: { sessionId: existing.id, question: cq.question, intent: cq.intent, turnCount: (existing.turns as Turn[]).length, done: false } };
  }
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({ user_id: viewer.id, role_id: roleId, current_question: first })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "We couldn't start the interview. Try again." };
  return { ok: true, step: { sessionId: data.id, ...first, turnCount: 0, done: false } };
}

const answerSchema = z.object({
  sessionId: z.string().min(1),
  roleId: z.string().min(1),
  answer: z.string().trim().min(2).max(6000),
  mode: z.enum(["voice", "text"]),
});

/** Turns one answer into draft items (quotes checked against the answer) and asks the next question. */
export async function submitAnswer(input: z.input<typeof answerSchema>): Promise<AnswerResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a little more, then try again." };
  const { sessionId, roleId, answer, mode } = parsed.data;
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };

  if (viewer.preview) {
    const drafts: DraftItem[] = [
      {
        text: answer.length > 140 ? answer.slice(0, 137) + "..." : answer,
        source_quote: answer,
        metrics: extractMetrics(answer),
        ownership: /\bhelp|\bwe\b/i.test(answer) ? "helped" : "did",
        skills: [],
      },
    ];
    return {
      ok: true,
      drafts,
      followUp: /\d/.test(answer) ? null : "Roughly how many was that? A rough number is fine.",
      next: { sessionId, question: "What changed because of that work? Did anything get faster, cheaper or better?", intent: "result", turnCount: 1, done: false },
    };
  }
  if (!(await allow("interview"))) return { ok: false, error: RATE_LIMITED_MESSAGE };

  const supabase = await createClient();
  const [{ data: session }, vault] = await Promise.all([
    supabase.from("interview_sessions").select("id, role_id, turns, current_question").eq("id", sessionId).eq("user_id", viewer.id).maybeSingle(),
    getVault(viewer),
  ]);
  const role = vault.roles.find((r) => r.id === roleId);
  if (!session || !role || session.role_id !== roleId) return { ok: false, error: "This interview has ended. Start it again from My experience." };
  const current = (session.current_question ?? { question: "", intent: "routine" }) as { question: string; intent: string };
  const roleRef = { kind: role.kind, title: role.title, organisation: role.organisation };

  const extracted = await runTask("extract_items", { role: roleRef, question: current.question, answer }, { userId: viewer.id });
  if (extracted.ok && extracted.data.not_english) {
    return { ok: false, notEnglish: true, error: "We can only use answers in English for now. Please say it again in English, or type it." };
  }
  // Only items whose quote really is in the answer survive.
  const drafts = extracted.ok ? extracted.data.items.filter((i) => quoteIsFrom(i.source_quote, answer)) : [];

  const turns: Turn[] = [...((session.turns as Turn[]) ?? []), { question: current.question, intent: current.intent, answer, mode, at: new Date().toISOString() }];
  const next = await runTask(
    "interview_next_question",
    {
      role: roleRef,
      known_items: role.items.map((i) => i.text).slice(0, 30),
      turns: turns.slice(-6).map((t) => ({ question: t.question, answer: t.answer })),
    },
    { userId: viewer.id },
  );
  const done = !next.ok || next.data.done || turns.length >= 8;
  const nextQ = next.ok ? { question: next.data.question, intent: next.data.intent } : { question: "Is there one thing from this role you're proud of?", intent: "wrap_up" };
  await supabase
    .from("interview_sessions")
    .update({ turns, current_question: done && turns.length >= 8 ? null : nextQ, status: done && turns.length >= 8 ? "finished" : "active" })
    .eq("id", sessionId);

  return {
    ok: true,
    drafts,
    followUp: extracted.ok ? extracted.data.follow_up : null,
    next: { sessionId, ...nextQ, turnCount: turns.length, done },
  };
}

const keepSchema = z.object({
  roleId: z.string().min(1),
  mode: z.enum(["voice", "text"]),
  items: z.array(draftItemSchema.extend({ ownership: z.enum(OWNERSHIP) })).max(6),
});

/** Saves the drafts the user ticked, as confirmed items with their words as the source. */
export async function keepItems(input: z.input<typeof keepSchema>): Promise<{ ok: boolean; saved: number; error?: string }> {
  const parsed = keepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, saved: 0, error: "Something didn't look right. Try again." };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, saved: 0, error: "Please sign in again." };
  if (viewer.preview) return { ok: true, saved: parsed.data.items.length };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("vault_items").insert(
    parsed.data.items.map((i) => ({
      user_id: viewer.id,
      role_id: parsed.data.roleId,
      text: i.text,
      metrics: i.metrics,
      skills: i.skills,
      ownership: i.ownership,
      source_quote: i.source_quote,
      source_type: parsed.data.mode,
      confirmed_at: now,
    })),
  );
  if (error) return { ok: false, saved: 0, error: "We couldn't save those. Try again." };
  revalidatePath("/experience", "layout");
  revalidatePath("/home");
  return { ok: true, saved: parsed.data.items.length };
}
