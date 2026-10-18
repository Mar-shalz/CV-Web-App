"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { getApplication } from "@/lib/applications/data";
import { getShortlist, generateQuestions, drillAnswer, saveInvite, updateShortlist, shortlistAccess, findWebQuestions, type DrillAttempt, type WebQuestion } from "@/lib/shortlist/data";
import type { ShortlistQuestion } from "@/lib/shortlist/questions";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { answerMock, endMock, newMock, type MockState } from "@/lib/shortlist/mock";

async function load(applicationId: string) {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please sign in again." } as const;
  const app = await getApplication(viewer, applicationId);
  if (!app) return { error: "We couldn't find this application." } as const;
  const access = await shortlistAccess(viewer, app.id);
  if (access === "locked" && !viewer.preview) return { error: "Shortlist mode needs a pass or an interview boost." } as const;
  return { viewer, app } as const;
}

export async function makeQuestions(applicationId: string): Promise<{ ok: true; questions: ShortlistQuestion[] } | { ok: false; error: string }> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "" };
  if (!(await allow("shortlist"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const view = await getShortlist(ctx.viewer, ctx.app);
  const questions = await generateQuestions(ctx.viewer, ctx.app, view);
  revalidatePath(`/applications/${applicationId}/shortlist`);
  return questions.length ? { ok: true, questions } : { ok: false, error: "We couldn't find lines in the CV you sent to build questions from." };
}

export async function submitDrill(applicationId: string, input: { questionId: string; answer: string; mode: "voice" | "text" }): Promise<{ ok: true; attempt: DrillAttempt } | { ok: false; error: string }> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "" };
  const answer = input.answer.trim();
  if (answer.length < 15) return { ok: false, error: "Give a fuller answer, the way you'd say it in the room." };
  if (answer.length > 6000) return { ok: false, error: "That answer is very long. In the room, aim for about a minute." };
  if (!(await allow("drill"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const view = await getShortlist(ctx.viewer, ctx.app);
  const res = await drillAnswer(ctx.viewer, view, input.questionId, answer, input.mode === "voice" ? "voice" : "text");
  if ("error" in res) return { ok: false, error: res.error };
  return { ok: true, attempt: res };
}

const inviteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  placeOrLink: z.string().max(300).nullable(),
  format: z.enum(["in_person", "video", "phone", "test", "unknown"]),
});

export async function saveInviteDetails(applicationId: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the date and time." };
  await saveInvite(ctx.viewer, ctx.app.id, parsed.data);
  revalidatePath(`/applications/${applicationId}/shortlist`);
  return { ok: true };
}

export async function toggleLogistic(applicationId: string, index: number, done: boolean): Promise<void> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return;
  const view = await getShortlist(ctx.viewer, ctx.app);
  const set = new Set(view.invite.logisticsDone);
  if (done) set.add(index);
  else set.delete(index);
  await updateShortlist(ctx.viewer, view.id, { invite_details: { ...view.invite, logisticsDone: [...set].filter((n) => Number.isInteger(n) && n >= 0 && n < 20) } });
}

/** Questions reported from real interviews, found on the web with their sources. */
export async function searchWebQuestions(applicationId: string): Promise<{ ok: true; questions: WebQuestion[] } | { ok: false; error: string }> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "" };
  if (!(await allow("shortlist"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const view = await getShortlist(ctx.viewer, ctx.app);
  const questions = await findWebQuestions(ctx.viewer, ctx.app, view);
  return questions.length ? { ok: true, questions } : { ok: false, error: "We couldn't find reported questions for this one right now. Practise the ones from your CV, and try again later." };
}

// The mock interview (D-189). The saved state is used; the screen's own copy only stands in
// when none is saved (the preview, or before the round 26 database update), checked first.
const mockSchema: z.ZodType<MockState> = z.object({
  turns: z
    .array(
      z.object({
        id: z.string().max(10),
        question: z.string().max(400),
        why: z.string().max(300).nullable(),
        kind: z.enum(["intro", "follow_up", "defend_cv", "job_fit", "situational", "technical", "standard", "closing"]),
        bulletId: z.string().max(80).nullable(),
        bulletText: z.string().max(500).nullable(),
        answer: z.string().max(3000).nullable(),
        mode: z.enum(["voice", "text"]).nullable(),
        feedback: z.object({ matches: z.enum(["yes", "partly", "no"]), didWell: z.string().max(300).nullable(), improve: z.array(z.string().max(300)).max(3), issues: z.array(z.string().max(400)).max(6) }).nullable(),
      }),
    )
    .min(1)
    .max(12),
  total: z.number().int().min(3).max(12),
  done: z.boolean(),
  wrap: z.object({ strengths: z.array(z.string().max(300)).max(3), workOn: z.array(z.string().max(300)).max(3) }).nullable(),
  startedAt: z.string().max(40),
});

export async function startMockInterview(applicationId: string): Promise<{ ok: true; mock: MockState } | { ok: false; error: string }> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "" };
  const view = await getShortlist(ctx.viewer, ctx.app);
  const mock = newMock();
  await updateShortlist(ctx.viewer, view.id, { mock_interview: mock });
  return { ok: true, mock };
}

export async function answerMockInterview(applicationId: string, input: { answer: string; mode: "voice" | "text"; state?: unknown }): Promise<{ ok: true; mock: MockState } | { ok: false; error: string }> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "" };
  const answer = input.answer.trim();
  if (answer.length < 15) return { ok: false, error: "Give a fuller answer, the way you'd say it in the room." };
  if (answer.length > 3000) return { ok: false, error: "That answer is very long. In the room, aim for about a minute." };
  if (!(await allow("drill"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const view = await getShortlist(ctx.viewer, ctx.app);
  const own = view.mock ?? mockSchema.safeParse(input.state).data ?? null;
  const res = await answerMock(ctx.viewer, ctx.app, { ...view, mock: own }, answer, input.mode === "voice" ? "voice" : "text");
  return "error" in res ? { ok: false, error: res.error } : { ok: true, mock: res };
}

export async function endMockInterview(applicationId: string, state?: unknown): Promise<{ ok: true; mock: MockState } | { ok: false; error: string }> {
  const ctx = await load(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "" };
  if (!(await allow("drill"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const view = await getShortlist(ctx.viewer, ctx.app);
  const own = view.mock ?? mockSchema.safeParse(state).data ?? null;
  const res = await endMock(ctx.viewer, ctx.app, { ...view, mock: own });
  return "error" in res ? { ok: false, error: res.error } : { ok: true, mock: res };
}
