import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmployeeSaveError } from "./errors";
import { EmployeeValidationError } from "./validation";

function tokenKey() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new EmployeeSaveError("The database connection is not configured yet.", 503);
  return key;
}

export function normalizeEmployeeCode(input: unknown) {
  if (typeof input !== "string" || !input.trim() || input.trim().length > 100) {
    throw new EmployeeValidationError("Please enter your Employee Code.");
  }
  return input.trim().toUpperCase();
}

// Binds an update to the exact record returned by lookup. It is not identity verification.
export function createLookupToken(employeeId: string, employeeCode: string) {
  const payload = Buffer.from(JSON.stringify({ employeeId, employeeCode, expires: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", tokenKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyLookupToken(token: string, employeeCode: string) {
  try {
    if (token.length > 1500) throw new Error();
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) throw new Error();
    const expected = createHmac("sha256", tokenKey()).update(payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error();
    const result = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (result.employeeCode !== employeeCode || typeof result.expires !== "number" || result.expires < Date.now()
      || typeof result.employeeId !== "string" || !/^\d+$/.test(result.employeeId)) throw new Error();
    return result.employeeId as string;
  } catch {
    throw new EmployeeSaveError("Please check your Employee Code again before submitting your changes.", 409);
  }
}

export async function lookupEmployeeInformation(input: unknown) {
  const employeeCode = normalizeEmployeeCode(input);
  let supabase;
  try { supabase = createSupabaseServerClient(); }
  catch (error) {
    console.error("Employee lookup configuration error", error instanceof Error ? error.message : "UNKNOWN");
    throw new EmployeeSaveError("Profile lookup is temporarily unavailable. Please contact HR or try again later.", 503);
  }
  const { data, error } = await supabase.rpc("get_employee_form_by_code", { p_employee_code: employeeCode });
  if (error) {
    if (error.code === "21000") throw new EmployeeSaveError("More than one profile has this Employee Code. Please contact HR.", 409);
    console.error("Employee lookup failed", { code: error.code });
    throw new EmployeeSaveError("Your profile could not be checked. Please try again.");
  }
  if (!data) return { found: false, employeeCode };
  const [phoneResult, emergencyResult] = await Promise.all([
    supabase.from("employee_phone_numbers").select("label, phone_number").eq("employee_id", data.employeeId).order("sort_order"),
    supabase.from("employees").select("emergency_contact_additional_number").eq("id", data.employeeId).single(),
  ]);
  if (phoneResult.error || emergencyResult.error) {
    console.error("Employee contact lookup failed", { code: phoneResult.error?.code || emergencyResult.error?.code });
    throw new EmployeeSaveError("Your profile could not be checked. Please try again.");
  }

  const values: Record<string, string> = {};
  const preservedCase = ["employee_email", "personal_email", "company_email", "vici_link", "avatar_url"];
  for (const [key, value] of Object.entries(data.values)) {
    const text = value == null ? "" : String(value).trim();
    values[key] = preservedCase.includes(key) ? text : text.toUpperCase();
  }
  values.employee_code = employeeCode;
  values.account_lob_assignments = JSON.stringify(Array.isArray(data.assignments) ? data.assignments : []);
  values.additional_contact_numbers = JSON.stringify((phoneResult.data ?? []).map((phone) => ({ label: phone.label, number: phone.phone_number })));
  values.emergency_contact_additional_number = String(emergencyResult.data.emergency_contact_additional_number ?? "").trim().toUpperCase();
  values.employee_name = [values.first_name, values.middle_name, values.last_name, values.suffix].filter(Boolean).join(" ") || values.employee_name;
  if (["DAY", "MID", "NIGHT"].includes(values.shift_type)) values.shift_type += " SHIFT";
  const shift = values.shift?.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (shift) values.shift = `${Number(shift[1])}:${shift[2] || "00"} ${shift[3].toUpperCase()} - ${Number(shift[4])}:${shift[5] || "00"} ${shift[6].toUpperCase()}`;
  return {
    found: true, employeeCode, values, options: data.options, assignments: data.assignments ?? [],
    lookupToken: createLookupToken(String(data.employeeId), employeeCode),
  };
}
