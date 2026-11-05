import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSyntheticLoginEmail, resolveLoginEmail } from "@/lib/credentials";
import { ensureTemporaryAuthUser } from "@/lib/auth-users";

type LoginRequest = { email?: unknown; password?: unknown };

function loginError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * TEMPORARY login bridge: the password field is the Employee Code. The
 * server resolves the employee's canonical login email (first email on
 * file, or a synthetic one when none is on file) and guarantees a matching
 * auth account exists before the client completes the standard Supabase
 * sign-in. No database schema change is involved.
 */
export async function POST(request: Request) {
  let body: LoginRequest;
  try {
    body = await request.json() as LoginRequest;
  } catch {
    return loginError("Your sign-in could not be read. Please try again.", 400);
  }
  // Accepted for compatibility with the login form; the Employee Code is
  // the credential in the temporary scheme, so the submitted email is not
  // used to resolve the account.
  const code = typeof body.password === "string" ? body.password.trim().toUpperCase() : "";
  if (!code || code.length > 100 || !/\d/.test(code)) return loginError("Enter your Employee Code as the password.", 400);

  let supabase;
  try { supabase = createSupabaseServerClient(); }
  catch (error) {
    console.error("Sign-in configuration error", error instanceof Error ? error.message : "UNKNOWN");
    return loginError("Sign-in is temporarily unavailable. Please contact HR or try again later.", 503);
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("employee_code, personal_email, employee_email, company_email")
    .eq("employee_code", code)
    .maybeSingle();
  if (employeeError) {
    console.error("Sign-in employee lookup failed", { code: employeeError.code });
    return loginError("Your sign-in could not be checked. Please try again.", 503);
  }
  if (!employee) {
    return loginError("The email address or Employee Code is incorrect.", 401);
  }
  // TEMPORARY scheme: the Employee Code is the credential, so a correct code
  // always resolves to that employee's canonical login email. The submitted
  // email is a hint only — small typos or a different on-file address must
  // not lock an employee out of the temporary login.
  const canonicalEmail = resolveLoginEmail(employee);

  const ensured = await ensureTemporaryAuthUser(supabase, canonicalEmail, code);
  if (!ensured.ok) {
    console.error("Credential setup failed during sign-in", { code: ensured.code });
    return loginError("Your sign-in could not be prepared. Please try again.", 503);
  }
  return Response.json({ ok: true, email: canonicalEmail, synthetic: isSyntheticLoginEmail(canonicalEmail) }, { headers: { "Cache-Control": "no-store" } });
}
