"use server";

import { getViewer } from "@/lib/auth/viewer";
import { DESIGN_REQUESTS, recordDesignEvent, type DesignRequest } from "@/lib/cv/design-usage";
import { track } from "@/lib/analytics/server";

/** "None of these designs?" (D-148): counted anonymously, so new designs follow demand. */
export async function requestDesign(reason: string): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer || !(DESIGN_REQUESTS as readonly string[]).includes(reason)) return { ok: false };
  await recordDesignEvent("request", { reason: reason as DesignRequest });
  await track("cv_design_requested", { reason }, viewer.preview ? undefined : viewer.id);
  return { ok: true };
}
