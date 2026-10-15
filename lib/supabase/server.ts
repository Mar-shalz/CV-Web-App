import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

const scoped = new AsyncLocalStorage<SupabaseClient>();

/**
 * Runs `fn` with this client in place of the cookie session, for the browser extension's
 * fit check (D-164), which signs in with its own key. Only for code paths whose every
 * query filters by the person's id (getJob, getVault, eligibility, getVerdict, getExtras).
 */
export function withClient<T>(client: SupabaseClient, fn: () => Promise<T>): Promise<T> {
  return scoped.run(client, fn);
}

export async function createClient(): ReturnType<typeof cookieClient> {
  const override = scoped.getStore();
  if (override) return override as unknown as Awaited<ReturnType<typeof cookieClient>>;
  return cookieClient();
}

async function cookieClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component. The proxy refreshes the session instead.
        }
      },
    },
  });
}
