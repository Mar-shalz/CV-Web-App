"use server";

import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { markInboxRead } from "./data";

const ids = z.array(z.string().max(80)).max(60);

/** Called when the Updates panel opens: everything in it counts as seen. */
export async function markUpdatesRead(input: string[]): Promise<void> {
  const viewer = await getViewer();
  const parsed = ids.safeParse(input);
  if (!viewer || !parsed.success) return;
  await markInboxRead(viewer, parsed.data);
}
