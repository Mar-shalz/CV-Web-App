import "server-only";
import type { CaptureInput } from "./capture";

const MAX_BYTES = 4 * 1024 * 1024;

/** Reads the capture form (paste, link, file or screenshot) into a CaptureInput, or an error to show. */
export async function readCaptureForm(form: FormData): Promise<CaptureInput | { error: string }> {
  const mode = String(form.get("mode") ?? form.get("source_type") ?? "paste");
  const file = form.get("file");
  if ((mode === "file" || mode === "screenshot") && file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "That file is too big. Use one under 4MB, or paste the text instead." };
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
  return { mode: "paste", text };
}
