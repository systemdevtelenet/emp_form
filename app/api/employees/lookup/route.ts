import { lookupEmployeeInformation } from "@/lib/employees/lookup";
import { EmployeeSaveError } from "@/lib/employees/save";
import { EmployeeValidationError } from "@/lib/employees/validation";
import { hasSameOrigin } from "@/lib/http/origin";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!hasSameOrigin(request)) return Response.json({ error: "Please use the employee form page." }, { status: 403, headers });
  let code: unknown;
  try { code = (await request.json()).employeeCode; }
  catch { return Response.json({ error: "Please enter your Employee Code." }, { status: 400, headers }); }
  try {
    return Response.json(await lookupEmployeeInformation(code), { headers });
  } catch (error) {
    if (error instanceof EmployeeValidationError) return Response.json({ error: error.message }, { status: 400, headers });
    if (error instanceof EmployeeSaveError) return Response.json({ error: error.message }, { status: error.status, headers });
    console.error("Employee lookup failed unexpectedly");
    return Response.json({ error: "Your profile could not be checked. Please try again." }, { status: 500, headers });
  }
}
