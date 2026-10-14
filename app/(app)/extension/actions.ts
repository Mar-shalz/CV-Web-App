"use server";

import { getViewer } from "@/lib/auth/viewer";
import { createExtensionToken, revokeExtensionTokens } from "@/lib/ext/auth";
import { flash } from "@/lib/toast";

/** Makes this browser's extension key (D-144). Only for the signed in person, and only from our own page. */
export async function connectExtension(label: string): Promise<{ ok: true; token: string; name: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (viewer.preview) return { ok: true, token: "preview-token-preview-token-preview-token-0001", name: viewer.fullName ?? "You" };
  try {
    const token = await createExtensionToken(viewer.id, label.replace(/[^\w .,()-]/g, "").slice(0, 80) || "Chrome");
    return { ok: true, token, name: viewer.fullName ?? viewer.email };
  } catch {
    return { ok: false, error: "We couldn't connect it just now. Try again." };
  }
}

/** Signs every connected browser's extension out. */
export async function disconnectAll(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.preview) return;
  await revokeExtensionTokens(viewer.id);
  await flash("Every browser extension is signed out.", "info");
}
