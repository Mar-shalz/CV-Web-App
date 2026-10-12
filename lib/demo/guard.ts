import "server-only";
import { notFound } from "next/navigation";
import { requireReadyViewer } from "@/lib/auth/viewer";

/**
 * The check, CV and pack screens run on sample data in the design preview until
 * Slices 3 to 6 build the real pipeline. Anywhere else they 404.
 */
export async function requireDemoJob(id: string) {
  const viewer = await requireReadyViewer();
  if (id !== "demo" || !viewer.preview) notFound();
  return viewer;
}
