import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { z } from "zod";
import { pseudonymousId } from "@/lib/analytics/server";
import { chainProvider } from "./chain";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consoleLogger, type AiCallLog } from "./log";
import { runAiTask, type AiDeps } from "./run";
import { TASKS, type TaskName } from "./tasks";
import type { AiResult, AiTask } from "./types";

export type { AiResult, FallbackReason } from "./types";
export type { TaskName } from "./tasks";

// No shared result cache yet. Tasks with a cache key (parse_cv, parse_job and others)
// arrive with their slices, and so does the store behind them.
/**
 * Every call also goes to ai_call_logs (no prompt or answer text), so the back office
 * shows cost, failures and which model answered. Written after the response when
 * possible; a logging failure never affects the user.
 */
function persist(record: AiCallLog) {
  const { event: _event, ...row } = record;
  void _event;
  const write = async () => {
    try {
      await createAdminClient().from("ai_call_logs").insert(row);
    } catch {
      // No secret key here (local preview) or the table is missing: stdout still has it.
    }
  };
  try {
    after(write);
  } catch {
    void write();
  }
}

/** Same logging as every task, for steps outside runTask (the web research step). */
export function logAiCall(record: AiCallLog) {
  consoleLogger(record);
  persist(record);
}

const deps: AiDeps = {
  // Gemini first while testing on its free tier, then Anthropic (D-068).
  provider: chainProvider,
  log: (record) => {
    consoleLogger(record);
    persist(record);
  },
  cache: null,
  reportError: (error, context) => {
    Sentry.captureException(error, { tags: context });
  },
};

/**
 * The only way the app calls a model. Server only: the browser never talks to a
 * model provider (Build pack section 6).
 */
type Input<K extends TaskName> = (typeof TASKS)[K]["input"];
type Output<K extends TaskName> = (typeof TASKS)[K]["output"];

export function runTask<K extends TaskName>(
  name: K,
  input: z.input<Input<K>>,
  options: { userId?: string } = {},
): Promise<AiResult<z.output<Output<K>>>> {
  // TASKS[name] widens to a union of tasks; the key pins it back to one.
  const base = TASKS[name] as unknown as AiTask<Input<K>, Output<K>>;
  // AI_BUDGET_MODE=haiku runs every task on the cheapest model: for testing on a small
  // budget only. Quality gates are measured on the models each task names.
  const task = process.env.AI_BUDGET_MODE === "haiku" ? { ...base, model: "claude-haiku-5-5" as const } : base;
  // With more than one task the generic widens; the key above already pins the types.
  return (
    runAiTask(task, input, deps, {
      userRef: options.userId ? pseudonymousId(options.userId) : null,
    }) as Promise<AiResult<z.output<Output<K>>>>
  ).then((res) => (res.ok ? { ...res, data: noEmDashes(res.data) } : res));
}

/**
 * Nothing a model writes reaches the app with an em dash (copy rule, founder round 24):
 * every string in every task's output is cleaned in this one place.
 */
export function noEmDashes<T>(value: T): T {
  if (typeof value === "string") return value.replace(/\s*\u2014\s*/g, ", ").replace(/,\s*,/g, ",") as T;
  if (Array.isArray(value)) return value.map(noEmDashes) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, noEmDashes(v)])) as T;
  return value;
}
