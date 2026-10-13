import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("DATABASE_NOT_CONFIGURED");
  }
  let legacyServiceRole = false;
  if (key.split(".").length === 3) {
    try { legacyServiceRole = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role"; }
    catch { /* An invalid key is rejected below. */ }
  }
  if (!key.startsWith("sb_secret_") && !legacyServiceRole) {
    throw new Error("DATABASE_REQUIRES_SERVER_SECRET_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
