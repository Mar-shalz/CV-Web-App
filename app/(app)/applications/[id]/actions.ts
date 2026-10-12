"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { getApplication } from "@/lib/applications/data";
import { changeStatus, type OutcomeSource } from "@/lib/applications/status";
import { readEmployerMessage, type InviteDetails, type OutcomeSuggestion } from "@/lib/applications/outcome";
import { saveInvite } from "@/lib/shortlist/data";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { STATUSES, opensShortlist } from "@/lib/rules/status-flow";

type Result = { ok: true; shortlist?: boolean } | { ok: false; error: string };

const statusSchema = z.enum(STATUSES);

function refresh(id: string) {
  revalidatePath(`/applications/${id}`);
  revalidatePath("/applications");
  revalidatePath("/home");
}

/** One tap status update from the detail screen. */
export async function setStatus(applicationId: string, to: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const status = statusSchema.safeParse(to);
  if (!status.success) return { ok: false, error: "That isn't a status we know." };
  if (viewer.preview) return { ok: true, shortlist: opensShortlist(status.data) };
  const res = await changeStatus(viewer, applicationId, status.data, { source: "tap" });
  if ("error" in res) return { ok: false, error: res.error };
  refresh(applicationId);
  return { ok: true, shortlist: opensShortlist(status.data) };
}

/** Paste their reply: the model reads it and suggests, nothing changes yet. */
export async function readMessage(applicationId: string, message: string): Promise<{ ok: true; suggestion: OutcomeSuggestion } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const text = message.trim();
  if (text.length < 10) return { ok: false, error: "Paste the whole message so we can read it." };
  if (text.length > 6000) return { ok: false, error: "That message is very long. Paste just the part from the employer." };
  if (!(await allow("classify"))) return { ok: false, error: RATE_LIMITED_MESSAGE };
  const app = await getApplication(viewer, applicationId);
  if (!app) return { ok: false, error: "We couldn't find this application." };
  return { ok: true, suggestion: await readEmployerMessage(viewer, app, text) };
}

const confirmSchema = z.object({
  to: statusSchema,
  evidence: z.string().max(400).nullable(),
  source: z.enum(["forwarded_email", "pasted_sms"]),
  invite: z
    .object({ date: z.string().nullable(), time: z.string().nullable(), placeOrLink: z.string().max(300).nullable(), format: z.enum(["in_person", "video", "phone", "test", "unknown"]) })
    .nullable(),
});

/** The person confirmed what their message says. Verified when we found the quote in it. */
export async function confirmFromMessage(applicationId: string, input: { to: string; evidence: string | null; source: OutcomeSource; invite: InviteDetails | null }): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Something went wrong. Try again." };
  const { to, evidence, source, invite } = parsed.data;
  if (viewer.preview) return { ok: true, shortlist: opensShortlist(to) };
  const res = await changeStatus(viewer, applicationId, to, { source, evidence, verified: Boolean(evidence) });
  if ("error" in res) return { ok: false, error: res.error };
  if (invite && (to === "interview" || to === "second_interview" || to === "assessment")) await saveInvite(viewer, applicationId, invite);
  refresh(applicationId);
  return { ok: true, shortlist: opensShortlist(to) || to === "second_interview" };
}
