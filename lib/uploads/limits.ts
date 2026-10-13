import { LIMITS } from "@/lib/config";

// Upload limits, shared by the browser and the server. Values live in config/limits.json.
export const UPLOAD_MAX_BYTES = LIMITS.files.upload_max_mb * 1024 * 1024;
/** Above this, the file goes straight to storage instead of through our server. */
export const INLINE_MAX_BYTES = LIMITS.files.inline_max_mb * 1024 * 1024;

export function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")}MB`;
}

/** Says plainly what's wrong and what to do. */
export function tooBigMessage(bytes: number, alternative = "paste the text instead"): string {
  return `This file is ${sizeLabel(bytes)}. Files can be up to ${LIMITS.files.upload_max_mb}MB. Use a smaller file, or ${alternative}.`;
}
