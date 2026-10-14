"use client";

import { startUpload } from "@/lib/uploads/actions";
import { INLINE_MAX_BYTES } from "@/lib/uploads/limits";

/**
 * Adds a file to a form. Small files go inline; big ones (up to the limit) go straight
 * to storage first and only their path is sent, because the host caps request bodies.
 */
export async function attachFile(body: FormData, file: File, prefix = ""): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.size <= INLINE_MAX_BYTES) {
    body.append(`${prefix}file`, file);
    return { ok: true };
  }
  const ticket = await startUpload({ name: file.name, type: file.type || "application/octet-stream", size: file.size });
  if (!ticket.ok) return ticket;
  if ("preview" in ticket) {
    body.append(`${prefix}upload_path`, "preview");
    return { ok: true };
  }
  // Loaded only for big files, so the storage library never weighs on first load.
  const { createBrowserSupabase } = await import("@/lib/supabase/client");
  const { error } = await createBrowserSupabase().storage.from("job-uploads").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || undefined });
  if (error) return { ok: false, error: "The upload didn't finish. Check your connection and try again." };
  body.append(`${prefix}upload_path`, ticket.path);
  body.append(`${prefix}upload_name`, file.name);
  return { ok: true };
}
