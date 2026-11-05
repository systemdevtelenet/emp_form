import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveLoginEmail } from "@/lib/credentials";
import { ensureTemporaryAuthUser } from "@/lib/auth-users";

type ClaimRequest = { employeeCode?: unknown };

function claimError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * TEMPORARY claim flow: only the Employee Code is required. The login is
 * created against the first email on file for that employee, or a synthetic
 * login email when none is on file (see lib/credentials.ts). The password
 * is the Employee Code itself. No database schema change is involved.
 */
export async function POST(request: Request) {
  let body: ClaimRequest;
  try {
    body = await request.json() as ClaimRequest;
  } catch {
    return claimError("Your registration could not be read. Please try again.", 400);
  }
  const employeeCode = typeof body.employeeCode === "string" ? body.employeeCode.trim().toUpperCase() : "";
  if (!employeeCode || employeeCode.length > 100 || !/\d/.test(employeeCode)) {
    return claimError("Enter your Employee Code.", 400);
  }

  let supabase;
  try { supabase = createSupabaseServerClient(); }
  catch (error) {
    console.error("Registration configuration error", error instanceof Error ? error.message : "UNKNOWN");
    return claimError("Registration is temporarily unavailable. Please contact HR or try again later.", 503);
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("employee_code, personal_email, employee_email, company_email, first_name")
    .eq("employee_code", employeeCode)
    .maybeSingle();
  if (employeeError) {
    console.error("Registration employee lookup failed", { code: employeeError.code });
    return claimError("Your Employee Code could not be checked. Please try again.", 503);
  }
  if (!employee) {
    return claimError("No employee record was found for this code. Verify the code or contact HR.", 404);
  }
  const email = resolveLoginEmail(employee);

  const ensured = await ensureTemporaryAuthUser(supabase, email, employeeCode, { first_name: employee.first_name });
  if (!ensured.ok) {
    console.error("Credential creation failed", { code: ensured.code });
    return claimError("Your account could not be created. Please try again.", 503);
  }
  return Response.json({ ok: true, email }, { headers: { "Cache-Control": "no-store" } });
}
