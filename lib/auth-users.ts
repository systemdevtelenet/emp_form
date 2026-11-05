import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { temporaryPasswordFor } from "./credentials";

/**
 * TEMPORARY account provisioning: guarantees an auth user exists for the
 * canonical login email with the temporary password (the Employee Code).
 * Imported users in this system have no password at all, so an existing
 * account must have its password set — creating alone is not enough.
 * No database schema change is involved; this only uses the Auth admin API.
 */
export async function ensureTemporaryAuthUser(
  supabase: SupabaseClient,
  email: string,
  employeeCode: string,
  extraMetadata: Record<string, unknown> = {},
) {
  const password = temporaryPasswordFor(employeeCode);
  const metadata = { employee_code: employeeCode, credential_scheme: "employee-code", ...extraMetadata };

  const { error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    // No email verification flow is configured, so the account is usable immediately.
    email_confirm: true,
    user_metadata: metadata,
  });
  if (!createError) return { ok: true as const };

  const isExists = createError.code === "email_exists" || /already (been )?registered|exists/i.test(createError.message);
  if (!isExists) return { ok: false as const, code: createError.code || "UNKNOWN" };

  // Existing (typically imported, password-less) account: set the temporary
  // password so the standard sign-in can succeed.
  const existing = await findAuthUserByEmail(supabase, email);
  if (!existing) return { ok: false as const, code: "USER_NOT_FOUND" };

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { ...existing.user_metadata, ...metadata },
  });
  if (updateError) return { ok: false as const, code: updateError.code || "UNKNOWN" };
  return { ok: true as const };
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string) {
  const target = email.trim().toLowerCase();
  const admin = supabase.auth.admin as unknown as {
    getUserByEmail?: (value: string) => Promise<{ data?: { user?: { id: string; user_metadata?: Record<string, unknown> } | null }; error?: unknown }>;
    listUsers: (options: { page: number; perPage: number }) => Promise<{ data: { users: Array<{ id: string; email?: string; user_metadata?: Record<string, unknown> }>; total: number }; error: unknown }>;
  };
  if (typeof admin.getUserByEmail === "function") {
    try {
      const result = await admin.getUserByEmail(target);
      if (result?.data?.user?.id) return result.data.user;
    } catch {
      // Fall through to the paginated list below.
    }
  }
  const perPage = 200;
  let page = 1;
  // Auth user counts here are in the hundreds; cap the scan generously.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const { data, error } = await admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const found = data.users.find((user) => (user.email ?? "").toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage || page * perPage >= data.total) return null;
    page += 1;
  }
  return null;
}
