import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKETS = ["job-uploads", "cv-exports"] as const;

/** Every file path under a folder, including sub folders (incoming/, sent/). */
async function listAll(db: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const paths: string[] = [];
  for (let offset = 0; offset < 10_000; offset += 100) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw error;
    if (!data?.length) break;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back without an id.
      if (entry.id === null) paths.push(...(await listAll(db, bucket, path, depth + 1)));
      else paths.push(path);
    }
    if (data.length < 100) break;
  }
  return paths;
}

/**
 * Deletes every file a person has in storage. The database cascade doesn't reach
 * storage, so account deletion calls this first. Returns false if anything failed.
 */
export async function removeUserFiles(db: SupabaseClient, userId: string): Promise<boolean> {
  try {
    for (const bucket of BUCKETS) {
      const paths = await listAll(db, bucket, userId);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (error) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
