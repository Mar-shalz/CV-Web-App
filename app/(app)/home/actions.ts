"use server";

import { flash } from "@/lib/toast";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { changeStatus, snoozeCheckIn } from "@/lib/applications/status";

const schema = z.object({
  application_id: z.uuid(),
  answer: z.enum(["interview", "rejected", "nothing_yet"]),
});

/** One tap check in answer. Status changes follow the deterministic status flow. */
export async function answerCheckIn(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.preview) return;
  const parsed = schema.safeParse({ application_id: formData.get("application_id"), answer: formData.get("answer") });
  if (!parsed.success) return;
  const { application_id: id, answer } = parsed.data;

  if (answer === "nothing_yet") {
    await snoozeCheckIn(viewer, id);
    await flash("Noted. We'll ask again in a few days.", "info");
  } else {
    const res = await changeStatus(viewer, id, answer, { source: "tap" });
    // An invite opens Shortlist mode straight away.
    if ("ok" in res && answer === "interview") {
      revalidatePath("/", "layout");
      redirect(`/applications/${id}/shortlist`);
    }
  }
  if (answer === "rejected") await flash("Updated. Thanks for telling us.", "info");
  // The updates panel in the top bar shows on every page, so refresh them all.
  revalidatePath("/", "layout");
}
