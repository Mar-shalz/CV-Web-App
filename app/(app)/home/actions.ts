"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { canTransition, type ApplicationStatus } from "@/lib/rules/status-flow";

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

  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("id, status")
    .eq("id", parsed.data.application_id)
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (!app) return;

  if (parsed.data.answer === "nothing_yet") {
    // Ask again in a week; silence becomes No response automatically at 30 days.
    await supabase
      .from("applications")
      .update({ next_check_in_at: new Date(Date.now() + 7 * 86400000).toISOString() })
      .eq("id", app.id);
  } else {
    const to = parsed.data.answer as ApplicationStatus;
    if (!canTransition(app.status as ApplicationStatus, to)) return;
    await supabase.from("applications").update({ status: to, next_check_in_at: null }).eq("id", app.id);
    await supabase
      .from("outcome_events")
      .insert({ application_id: app.id, user_id: viewer.id, from_status: app.status, to_status: to, source: "tap" });
  }
  revalidatePath("/home");
}
