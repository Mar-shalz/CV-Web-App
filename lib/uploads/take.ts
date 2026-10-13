import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UPLOAD_MAX_BYTES } from "./limits";

/**
 * Reads a file the browser uploaded straight to storage, then deletes it. Only paths in
 * the person's own incoming folder are accepted.
 */
export async function takeUpload(supabase: SupabaseClient, userId: string, path: string): Promise<{ bytes: Buffer; type: string } | { error: string }> {
  if (!path.startsWith(`${userId}/incoming/`) || path.includes("..")) return { error: "We couldn't find that upload. Try again." };
  const { data, error } = await supabase.storage.from("job-uploads").download(path);
  // Delete straight away, whatever happens next: the file is only needed for this read.
  await supabase.storage.from("job-uploads").remove([path]);
  if (error || !data) return { error: "We couldn't find that upload. Try again." };
  if (data.size > UPLOAD_MAX_BYTES) return { error: "That file is too big." };
  return { bytes: Buffer.from(await data.arrayBuffer()), type: data.type };
}
