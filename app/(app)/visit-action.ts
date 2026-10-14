"use server";

import { headers } from "next/headers";
import { getViewer } from "@/lib/auth/viewer";
import { recordVisit } from "@/lib/activity";

/** One visit: called once when the app is opened, and again after 30 minutes away. */
export async function markVisit(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.preview) return;
  const country = (await headers()).get("x-vercel-ip-country");
  await recordVisit(viewer.id, country);
}
