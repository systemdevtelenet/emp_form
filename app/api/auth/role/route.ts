import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveDashboardRole } from "@/lib/roles";

/**
 * Resolves the signed-in employee's dashboard role from their session token.
 * The client sends `Authorization: Bearer <accessToken>`; the token is
 * verified against Supabase Auth, so a forged header cannot gain a role.
 */
export async function POST(request: Request) {
  let supabase;
  try { supabase = createSupabaseServerClient(); }
  catch (error) {
    console.error("Role resolution configuration error", error instanceof Error ? error.message : "UNKNOWN");
    return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Missing session." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { data: session, error: sessionError } = await supabase.auth.getUser(token);
  if (sessionError || !session.user?.email) {
    return Response.json({ error: "Your session could not be verified. Please sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const email = session.user.email.toLowerCase();
  // TEMPORARY scheme: auth users created for employees with no email on file
  // use a synthetic login email, so email alone cannot find their record.
  // The employee code stamped into auth metadata is the reliable key.
  const metadataCode = typeof session.user.user_metadata?.employee_code === "string"
    ? session.user.user_metadata.employee_code.trim().toUpperCase()
    : "";

  const select = "employee_name, position_id, position_other, employee_code, position:positions(position_name), levels";
  type EmployeeRow = {
    employee_name: string | null;
    position_id: number | null;
    position_other: string | null;
    employee_code: string | null;
    levels: string | null;
    position: { position_name: string | null } | { position_name: string | null }[] | null;
  };
  let employee: EmployeeRow | null = null;
  let employeeError: { code?: string } | null = null;
  if (metadataCode) {
    const result = await supabase.from("employees").select(select).eq("employee_code", metadataCode).maybeSingle();
    employee = result.data;
    employeeError = result.error;
  }
  if (!employee && !employeeError) {
    const result = await supabase
      .from("employees")
      .select(select)
      .or(`company_email.ilike.${email},employee_email.ilike.${email},personal_email.ilike.${email}`)
      .maybeSingle();
    employee = result.data;
    employeeError = result.error;
  }
  if (employeeError) {
    console.error("Role employee lookup failed", { code: employeeError.code });
    return Response.json({ error: "Please try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!employee) {
    return Response.json({ resolved: false, dashboard: "/register", reason: "profile-missing" }, { headers: { "Cache-Control": "no-store" } });
  }
  const positionRecord = Array.isArray(employee.position) ? employee.position[0] : employee.position;
  const positionLabel = positionRecord?.position_name
    ? (employee.position_other ? `${positionRecord.position_name} (${employee.position_other})` : positionRecord.position_name)
    : employee.position_other ?? "";
  const resolution = resolveDashboardRole(positionLabel, employee.levels ?? "");
  return Response.json({
    resolved: true,
    role: resolution.role,
    dashboard: resolution.dashboard,
    name: employee.employee_name ?? "",
    position: positionLabel,
    employeeCode: employee.employee_code ?? "",
  }, { headers: { "Cache-Control": "no-store" } });
}
