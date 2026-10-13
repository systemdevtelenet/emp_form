export class EmployeeValidationError extends Error {}

const requiredFields: Record<string, string> = {
  employee_code: "Employee ID", first_name: "First name", last_name: "Last name",
  gender: "Gender", birthdate: "Birth date", contact_number: "Contact number",
  employee_email: "Company Gmail", personal_email: "Personal email",
  company_email: "Company email", site: "Work site", hire_date: "Hire date",
  position_id: "Position", account_id: "Account", lob_id: "LOB",
  Department: "Department", levels: "Level", shift_type: "Shift type", shift: "Shift",
};

const textFields = [
  "employee_code", "first_name", "middle_name", "last_name", "suffix", "gender",
  "contact_number", "site", "Department", "levels", "shift", "shift_type", "tu_units",
  "sss_number", "pag_ibig_number", "tin", "philhealth",
] as const;
const emailFields = ["employee_email", "personal_email", "company_email"] as const;
const addressFields = ["address_building", "address_street", "address_barangay", "address_city", "address_province"];
const levels = ["EXECUTIVE", "CORE MANAGER", "SENIOR LEAD", "JUNIOR LEAD", "APPRENTICE", "SPECIAL OPERATIONS AGENT", "AGENT"];
const genders = ["FEMALE", "MALE", "NON-BINARY", "ANOTHER IDENTITY", "PREFER NOT TO SAY"];

export function validateEmployeeSubmission(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new EmployeeValidationError("Please review your information and try again.");
  }

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || value.length > 1000) {
      throw new EmployeeValidationError("A field contains an invalid or overly long value.");
    }
    values[key] = value.trim();
  }
  for (const [key, label] of Object.entries(requiredFields)) {
    if (!values[key]) throw new EmployeeValidationError(`${label} is required. Please go back to complete it.`);
  }

  const employee: Record<string, string | number | null> = {};
  for (const key of textFields) employee[key] = values[key]?.toUpperCase() || null;
  for (const key of emailFields) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[key]) || values[key].length > 254) {
      throw new EmployeeValidationError(`Please enter a valid ${requiredFields[key].toLowerCase()}.`);
    }
    employee[key] = values[key];
  }

  for (const key of ["first_name", "middle_name", "last_name"]) {
    if ((values[key]?.length ?? 0) > 120) throw new EmployeeValidationError("Each name must be 120 characters or fewer.");
  }
  if ((values.suffix?.length ?? 0) > 40) throw new EmployeeValidationError("Suffix must be 40 characters or fewer.");
  if (!genders.includes(String(employee.gender))) throw new EmployeeValidationError("Please choose a gender option.");
  if (!levels.includes(String(employee.levels))) throw new EmployeeValidationError("Please choose a level.");
  if (!["DAY SHIFT", "MID SHIFT", "NIGHT SHIFT"].includes(String(employee.shift_type))) {
    throw new EmployeeValidationError("Please choose a shift type.");
  }
  if (!/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM) - (0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(String(employee.shift))) {
    throw new EmployeeValidationError("Enter your shift in the format 9:00 PM - 6:00 AM.");
  }

  function date(key: string, required: boolean) {
    const value = values[key];
    if (!value && !required) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new EmployeeValidationError(`Please enter a valid ${key === "birthdate" ? "birth date" : key === "hire_date" ? "hire date" : "leadership start date"}.`);
    }
    return value;
  }
  employee.birthdate = date("birthdate", true);
  employee.hire_date = date("hire_date", true);
  employee.hire_date_leader = date("hire_date_leader", employee.levels === "JUNIOR LEAD");
  employee.employee_name = [employee.first_name, employee.middle_name, employee.last_name, employee.suffix].filter(Boolean).join(" ");
  employee.address = addressFields.map((key) => values[key]?.toUpperCase()).filter(Boolean).join(", ")
    || (values.address_edited !== "true" ? values.address?.toUpperCase() || null : null);

  employee.vici_link = values.vici_link || null;
  if (values.vici_link) {
    try {
      if (!["http:", "https:"].includes(new URL(values.vici_link).protocol)) throw new Error();
    } catch {
      throw new EmployeeValidationError("Please enter a valid Vici link starting with https://, or leave it blank.");
    }
  }

  function id(key: string) {
    const value = Number(values[key]);
    if (!/^\d+$/.test(values[key]) || !Number.isSafeInteger(value) || value <= 0) {
      throw new EmployeeValidationError(`Please choose a valid ${requiredFields[key].toLowerCase()}.`);
    }
    return value;
  }
  employee.position_id = id("position_id");
  return { employee, accountId: id("account_id"), lobId: id("lob_id") };
}
