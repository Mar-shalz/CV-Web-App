import "server-only";
import type { CaptureInput } from "./capture";
import { UPLOAD_MAX_BYTES, tooBigMessage } from "@/lib/uploads/limits";

type Take = (path: string) => Promise<{ bytes: Buffer; type: string } | { error: string }>;

/**
 * Reads the capture form (paste, link, file or screenshot) into a CaptureInput, or an
 * error to show. Big files arrive as a storage path (see lib/client/upload.ts).
 */
export async function readCaptureForm(form: FormData, take?: Take): Promise<CaptureInput | { error: string }> {
  const mode = String(form.get("mode") ?? form.get("source_type") ?? "paste");
  const file = form.get("file");
  const uploadPath = form.get("upload_path");
  if ((mode === "file" || mode === "screenshot") && typeof uploadPath === "string" && uploadPath && take) {
    const got = await take(uploadPath);
    if ("error" in got) return got;
    const name = String(form.get("upload_name") ?? "upload");
    return mode === "screenshot" || got.type.startsWith("image/") ? { mode: "screenshot", bytes: got.bytes, type: got.type } : { mode: "file", bytes: got.bytes, name, type: got.type };
  }
  if ((mode === "file" || mode === "screenshot") && file instanceof File && file.size > 0) {
    if (file.size > UPLOAD_MAX_BYTES) return { error: tooBigMessage(file.size) };
    const bytes = Buffer.from(await file.arrayBuffer());
    return mode === "screenshot" || file.type.startsWith("image/") ? { mode: "screenshot", bytes, type: file.type } : { mode: "file", bytes, name: file.name, type: file.type };
  }
  if (mode === "link") {
    const url = String(form.get("url") ?? "").trim();
    if (!/^https?:\/\/\S+\.\S+/.test(url)) return { error: "Enter a full link, starting with https://" };
    return { mode: "link", url };
  }
  const text = String(form.get("text") ?? "").trim();
  if (text.length < 80) return { error: "Paste the full job description. It looks a bit short." };
  // Where the text came from, when the browser extension sent it (D-133).
  const source = String(form.get("source_url") ?? "").trim();
  return { mode: "paste", text, sourceUrl: /^https?:\/\/\S+\.\S+$/.test(source) && source.length <= 400 ? source : undefined };
}
