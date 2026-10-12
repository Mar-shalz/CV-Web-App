export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/**
 * Preview mode lets designers review screens locally before a Supabase project
 * exists. It can never switch on in a production build. See D-005.
 */
export function isPreviewMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return !isSupabaseConfigured();
}

export function assertConfigured(): void {
  if (!isSupabaseConfigured() && process.env.NODE_ENV === "production") {
    throw new Error("Supabase is not configured");
  }
}
