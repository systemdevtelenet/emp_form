import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmployeeValidationError, validateEmployeeSubmission } from "./validation";
import { createLookupToken, verifyLookupToken } from "./lookup";
import { EmployeeSaveError } from "./errors";
export { EmployeeSaveError } from "./errors";

export async function saveEmployeeInformation(input: unknown, photo: File | null, lookupToken = "") {
  const { employee, assignments, phoneNumbers } = validateEmployeeSubmission(input);
  const existingEmployeeId = lookupToken ? verifyLookupToken(lookupToken, String(employee.employee_code)) : null;
  const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  let bytes: Uint8Array | undefined;
  if (photo) {
    if (!imageTypes[photo.type] || !photo.size || photo.size > 5 * 1024 * 1024) {
      throw new EmployeeValidationError("Choose a JPG, PNG, or WEBP photo under 5 MB.");
    }
    bytes = new Uint8Array(await photo.arrayBuffer());
    const validImage = photo.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : photo.type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes![i] === byte)
        : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!validImage) throw new EmployeeValidationError("This file is not a supported image. Please choose another photo.");
  }

  let supabase;
  try { supabase = createSupabaseServerClient(); }
  catch (error) {
    console.error("Employee save configuration error", error instanceof Error ? error.message : "UNKNOWN");
    throw new EmployeeSaveError("Submitting is temporarily unavailable. Please contact HR or try again later.", 503);
  }

  const bucket = process.env.SUPABASE_PHOTO_BUCKET || "avatar";
  let photoPath: string | undefined;
  if (photo && bytes) {
    photoPath = `employee-forms/${crypto.randomUUID()}.${imageTypes[photo.type]}`;
    const { error } = await supabase.storage.from(bucket).upload(photoPath, bytes, { contentType: photo.type, upsert: false });
    if (error) throw new EmployeeSaveError("Your photo could not be uploaded. Please try again.");
    employee.avatar_url = supabase.storage.from(bucket).getPublicUrl(photoPath).data.publicUrl;
  }

  const { data, error } = await supabase.rpc("save_employee_information_with_phones", {
    p_employee: employee, p_assignments: assignments, p_existing_employee_id: existingEmployeeId,
    p_phone_numbers: phoneNumbers,
  });
  if (error) {
    // Only clean up on a confirmed database rejection. A network failure may occur after a commit.
    if (photoPath && error.code) {
      const { error: cleanupError } = await supabase.storage.from(bucket).remove([photoPath]);
      if (cleanupError) console.error("Employee photo cleanup failed", cleanupError.name);
    }
    if (error.code === "23505") throw new EmployeeSaveError("This Employee Code or Company Gmail is already registered. Choose a different code or contact HR.", 409);
    if (error.code === "P0002") throw new EmployeeSaveError("Your profile has changed or is no longer available. Please check your Employee Code again.", 409);
    if (["23503", "22023", "22007", "22008", "22P02"].includes(error.code)) {
      throw new EmployeeSaveError("Some details are invalid. Please review your contact and work details and try again.", 400);
    }
    console.error("Employee save failed", { code: error.code || "NETWORK_ERROR" });
    throw new EmployeeSaveError("We could not confirm your submission. Please try again. If your record is already registered, contact HR.");
  }
  if (typeof data !== "string" || !/^\d+$/.test(data)) {
    throw new EmployeeSaveError("We could not confirm your submission. Please contact HR before submitting again.");
  }
  return { employeeId: data, lookupToken: createLookupToken(data, String(employee.employee_code)) };
}
