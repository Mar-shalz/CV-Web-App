"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { UPLOAD_MAX_BYTES, tooBigMessage } from "./limits";

const ALLOWED = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/plain", "image/jpeg", "image/png", "image/webp"];

const input = z.object({ name: z.string().max(200), type: z.string().max(120), size: z.number().int().positive() });

export type UploadTicket = { ok: true; path: string; token: string } | { ok: true; preview: true } | { ok: false; error: string };

/**
 * A one time signed upload URL in the person's own folder of the private bucket, for
 * files too big to send through our server. The server reads the file once and deletes it.
 */
export async function startUpload(raw: { name: string; type: string; size: number }): Promise<UploadTicket> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "We couldn't read that file. Try again." };
  if (parsed.data.size > UPLOAD_MAX_BYTES) return { ok: false, error: tooBigMessage(parsed.data.size) };
  if (!ALLOWED.includes(parsed.data.type)) return { ok: false, error: "Use a PDF, a Word file, a text file or a photo." };
  if (viewer.preview) return { ok: true, preview: true };

  const safe = parsed.data.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  const path = `${viewer.id}/incoming/${randomUUID()}-${safe}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("job-uploads").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "We couldn't start the upload. Try again." };
  return { ok: true, path: data.path, token: data.token };
}
