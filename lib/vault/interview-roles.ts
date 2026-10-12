import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { getVault } from "./data";

export type InterviewRole = { id: string; title: string | null; organisation: string | null; kind: string; items: number };

/** Roles the story interview can ask about, fewest achievements first: that's where it helps most. */
export async function interviewRoles(viewer: Viewer): Promise<InterviewRole[]> {
  const vault = await getVault(viewer);
  return vault.roles
    .filter((r) => !["education", "certification", "licence"].includes(r.kind))
    .map((r) => ({ id: r.id, title: r.title, organisation: r.organisation, kind: r.kind, items: r.items.length }))
    .sort((a, b) => a.items - b.items);
}
