import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { z } from "zod";
import { pseudonymousId } from "@/lib/analytics/server";
import { anthropicProvider } from "./anthropic";
import { consoleLogger } from "./log";
import { runAiTask, type AiDeps } from "./run";
import { TASKS, type TaskName } from "./tasks";
import type { AiResult, AiTask } from "./types";

export type { AiResult, FallbackReason } from "./types";
export type { TaskName } from "./tasks";

// No shared result cache yet. Tasks with a cache key (parse_cv, parse_job and others)
// arrive with their slices, and so does the store behind them.
const deps: AiDeps = {
  provider: anthropicProvider,
  log: consoleLogger,
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
  const task = TASKS[name] as unknown as AiTask<Input<K>, Output<K>>;
  // With more than one task the generic widens; the key above already pins the types.
  return runAiTask(task, input, deps, {
    userRef: options.userId ? pseudonymousId(options.userId) : null,
  }) as Promise<AiResult<z.output<Output<K>>>>;
}
