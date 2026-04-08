import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(url && anonKey);

/** Prefer creating the client inside `useEffect` on the client so PKCE cookie storage is not initialized during SSR. */
export function createBrowserSupabaseClient(): SupabaseClient | null {
  if (!url || !anonKey) {
    return null;
  }
  return createBrowserClient(url, anonKey, { isSingleton: true });
}
