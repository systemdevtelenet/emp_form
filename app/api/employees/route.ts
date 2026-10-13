import { EmployeeSaveError, saveEmployeeInformation } from "@/lib/employees/save";
import { EmployeeValidationError } from "@/lib/employees/validation";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Please submit this form from its original page." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > 6 * 1024 * 1024) {
    return Response.json({ error: "Your upload is too large. Choose a photo under 5 MB." }, { status: 413 });
  }

  let input: unknown;
  let photo: File | null;
  let lookupToken = "";
  try {
    const form = await request.formData();
    const values = form.get("values");
    if (typeof values !== "string" || values.length > 40_000) throw new Error();
    input = JSON.parse(values);
    const token = form.get("lookupToken");
    if (token !== null && (typeof token !== "string" || token.length > 1500)) throw new Error();
    lookupToken = typeof token === "string" ? token : "";
    const file = form.get("photo");
    if (file !== null && !(file instanceof File)) throw new Error();
    photo = file instanceof File && file.size ? file : null;
  } catch {
    return Response.json({ error: "Please review your information and try again." }, { status: 400 });
  }

  try {
    const result = await saveEmployeeInformation(input, photo, lookupToken);
    return Response.json(result, { status: lookupToken ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof EmployeeValidationError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof EmployeeSaveError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Employee submission failed unexpectedly");
    return Response.json({ error: "Your information could not be saved. Please try again." }, { status: 500 });
  }
}
