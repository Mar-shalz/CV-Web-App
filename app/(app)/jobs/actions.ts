"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";

export type CaptureState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const schema = z.discriminatedUnion("source_type", [
  z.object({ source_type: z.literal("paste"), text: z.string().trim().min(80, "Paste the full job description. It looks a bit short.").max(30000) }),
  z.object({ source_type: z.literal("link"), url: z.url("Enter a full link, starting with https://") }),
  z.object({ source_type: z.literal("file") }),
  z.object({ source_type: z.literal("screenshot") }),
]);

/** Saves a captured job. Job text is untrusted input: stored as data, never acted on. */
export async function captureJob(_prev: CaptureState, formData: FormData): Promise<CaptureState> {
  const parsed = schema.safeParse({
    source_type: formData.get("source_type"),
    text: formData.get("text") ?? undefined,
    url: formData.get("url") ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { fieldErrors: { [String(issue?.path[0] ?? "form")]: issue?.message ?? "Check this and try again." } };
  }

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  // Design preview: continue to the sample job check.
  if (viewer.preview) redirect("/jobs/demo/check");

  const input = parsed.data;
  if (input.source_type === "file" || input.source_type === "screenshot") {
    return { error: "Uploads are still being built. For now, paste the job text or a link." };
  }

  const raw = input.source_type === "paste" ? input.text : input.url;
  const post_hash = createHash("sha256").update(raw.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: viewer.id,
      source_type: input.source_type,
      raw_text: input.source_type === "paste" ? input.text : null,
      source_url: input.source_type === "link" ? input.url : null,
      post_hash,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "We couldn't save this job. Check your connection and try again. Your text is still here." };
  redirect(`/jobs/${data.id}`);
}
