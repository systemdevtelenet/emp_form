import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseAuthConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Browser client for the login page. Only anon key is ever used here;
 * server-only keys stay in server code.
 *
 * "Remember me" maps to the provider's own session configuration:
 * persisted sessions survive reloads in localStorage; non-persisted
 * sessions stay in memory only. Token lifetimes remain issued by the
 * Supabase Auth server either way.
 */
export function createSupabaseBrowserClient(persistSession = true): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession,
      autoRefreshToken: persistSession,
      // No OAuth or magic-link callback is configured, so never consume the URL.
      detectSessionInUrl: false,
    },
  });
}
