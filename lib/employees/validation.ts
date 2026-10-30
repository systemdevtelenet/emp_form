export class EmployeeValidationError extends Error {}

const requiredFields: Record<string, string> = {
  employee_code: "Employee ID", first_name: "First name", last_name: "Last name",
  gender: "Gender", tax_status_code: "Tax Status Code", birthdate: "Birth date",
  hire_date: "Hire date",
  employment_status: "Employment status",
};

const textFields = [
  "employee_code", "first_name", "middle_name", "last_name", "suffix", "gender",
  "contact_number", "site", "Department", "levels", "shift", "shift_type", "tu_units",
  "sss_number", "pag_ibig_number", "tin", "philhealth", "tax_status_code",
] as const;
const emailFields = ["employee_email", "personal_email", "company_email"] as const;
const emailLabels: Record<(typeof emailFields)[number], string> = {
  employee_email: "Company Gmail", personal_email: "Personal email", company_email: "Company email",
};
const addressFields = ["address_building", "address_street", "address_barangay", "address_city", "address_province"];
const presentAddressFields = ["present_address_building", "present_address_street", "present_address_barangay", "present_address_city", "present_address_province"];
const levels = ["EXECUTIVE", "CORE MANAGER", "SENIOR LEAD", "JUNIOR LEAD", "APPRENTICE", "SPECIAL OPERATIONS AGENT", "AGENT", "L1", "L2", "L3"];
const genders = ["FEMALE", "MALE", "NON-BINARY", "ANOTHER IDENTITY", "PREFER NOT TO SAY"];
const taxStatusCodes = ["SINGLE", "MARRIED", "WIDOWED", "LEGALLY SEPARATED", "DIVORCED", "ANNULLED"];
const suffixes = ["JR.", "SR.", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const additionalPhoneLabels = ["COMPANY MOBILE", "PERSONAL MOBILE", "OFFICE / EXTENSION", "OTHER"];

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
  if (values.employee_code.length > 100) throw new EmployeeValidationError("Employee Code must be 100 characters or fewer.");

  const employee: Record<string, string | number | boolean | null> = {};
  for (const key of textFields) employee[key] = values[key]?.toUpperCase() || null;
  for (const key of emailFields) {
    if (!values[key]) {
      employee[key] = null;
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[key]) || values[key].length > 254) {
      throw new EmployeeValidationError(`Please enter a valid ${emailLabels[key].toLowerCase()}.`);
    }
    if (key === "company_email" && !/^[^\s@]+@cebutele-net\.com$/i.test(values[key])) {
      throw new EmployeeValidationError("Please use your Company email ending in @cebutele-net.com.");
    }
    employee[key] = values[key];
  }

  for (const key of ["first_name", "middle_name", "last_name"]) {
    if ((values[key]?.length ?? 0) > 120) throw new EmployeeValidationError("Each name must be 120 characters or fewer.");
  }
  if ((values.suffix?.length ?? 0) > 40) throw new EmployeeValidationError("Suffix must be 40 characters or fewer.");
  if (employee.suffix !== null && !suffixes.includes(String(employee.suffix))) throw new EmployeeValidationError("Please choose a suffix from the list.");
  if (!genders.includes(String(employee.gender))) throw new EmployeeValidationError("Please choose a gender option.");
  if (employee.tax_status_code !== null && !taxStatusCodes.includes(String(employee.tax_status_code))) throw new EmployeeValidationError("Please choose a valid Tax Status Code.");
  if (!["ACTIVE", "INACTIVE", "RESIGNED", "ON LEAVE", "AWOL", "LATERAL"].includes(String(values.employment_status).toUpperCase())) {
    throw new EmployeeValidationError("Please choose a valid employment status.");
  }
  employee.employment_status = String(values.employment_status).toUpperCase();
  if (employee.levels !== null && !levels.includes(String(employee.levels))) throw new EmployeeValidationError("Please choose a level.");
  if (employee.shift_type !== null && !["DAY SHIFT", "MID SHIFT", "NIGHT SHIFT"].includes(String(employee.shift_type))) {
    throw new EmployeeValidationError("Please choose a shift type.");
  }
  if (employee.shift !== null && !/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM) - (0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(String(employee.shift))) {
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
  const sameAsHome = values.present_address_same_as_home === "TRUE";
  employee.present_address_same_as_home = sameAsHome;
  employee.present_address = sameAsHome ? employee.address
    : presentAddressFields.map((key) => values[key]?.toUpperCase()).filter(Boolean).join(", ")
      || (values.present_address_edited !== "true" ? values.present_address?.toUpperCase() || null : null);
  for (const key of ["emergency_contact_name", "emergency_contact_relationship", "emergency_contact_number", "emergency_contact_additional_number", "emergency_contact_address"]) {
    employee[key] = values[key]?.toUpperCase() || null;
  }
  if (employee.emergency_contact_additional_number && (
    !/^[+0-9() .xX-]{5,40}$/.test(String(employee.emergency_contact_additional_number))
    || String(employee.emergency_contact_additional_number).replace(/\D/g, "").length < 5
  )) {
    throw new EmployeeValidationError("Enter a valid additional emergency contact number, or leave it blank.");
  }

  employee.vici_link = values.vici_link || null;
  if (values.vici_link) {
    try {
      if (!["http:", "https:"].includes(new URL(values.vici_link).protocol)) throw new Error();
    } catch {
      throw new EmployeeValidationError("Please enter a valid Vici link starting with https://, or leave it blank.");
    }
  }

  function id(key: string, required = true) {
    if (!values[key] && !required) return null;
    const value = Number(values[key]);
    if (!/^\d+$/.test(values[key]) || !Number.isSafeInteger(value) || value <= 0) {
      const label = requiredFields[key] ?? (key === "position_id" ? "Position" : key === "account_id" ? "Account" : "LOB");
      throw new EmployeeValidationError(`Please choose a valid ${label.toLowerCase()}.`);
    }
    return value;
  }
  employee.position_id = id("position_id", false);
  if ((values.position_other?.length ?? 0) > 120) throw new EmployeeValidationError("Other position must be 120 characters or fewer.");
  employee.position_other = employee.position_id ? values.position_other?.toUpperCase() || null : null;
  let phoneNumbers: { label: string; number: string }[] = [];
  if (values.additional_contact_numbers) {
    let parsed: unknown;
    try { parsed = JSON.parse(values.additional_contact_numbers); } catch { throw new EmployeeValidationError("Please review your additional contact numbers."); }
    if (!Array.isArray(parsed) || parsed.length > 5) throw new EmployeeValidationError("You can add up to five additional contact numbers.");
    const seen = new Set([String(employee.contact_number).replace(/\D/g, "")]);
    phoneNumbers = parsed.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new EmployeeValidationError("Please review your additional contact numbers.");
      const rawLabel = String((entry as Record<string, unknown>).label ?? "").trim().toUpperCase();
      const label = additionalPhoneLabels.includes(rawLabel) ? rawLabel : "OTHER";
      const number = String((entry as Record<string, unknown>).number ?? "").trim();
      const digits = number.replace(/\D/g, "");
      if (!/^[+0-9() .xX-]{5,40}$/.test(number) || digits.length < 5 || seen.has(digits)) {
        throw new EmployeeValidationError("Enter a unique valid additional contact number.");
      }
      seen.add(digits);
      return { label, number };
    });
  }
  let assignments: { account_id: number; account_type: string; lob_ids: number[] }[] = [];
  if (values.account_lob_assignments) {
    let parsed: unknown;
    try { parsed = JSON.parse(values.account_lob_assignments); } catch { throw new EmployeeValidationError("Please review your account and LOB selections."); }
    if (!Array.isArray(parsed) || parsed.length > 100) throw new EmployeeValidationError("Please review your account and LOB selections.");
    const accountIds = new Set<number>();
    assignments = parsed.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new EmployeeValidationError("Please review your account and LOB selections.");
      const account_id = Number((entry as Record<string, unknown>).account_id);
      const rawAccountType = String((entry as Record<string, unknown>).account_type ?? "").toUpperCase();
      const account_type = rawAccountType === "NON VOICE" ? "NON-VOICE" : rawAccountType;
      const rawLobs = (entry as Record<string, unknown>).lob_ids;
      if (!["NON-VOICE", "OUTBOUND", "INBOUND", "INBOUND/OUTBOUND", "VOICE", "VOICE - INBOUND", "ADMIN", "N/A"].includes(account_type)) {
        throw new EmployeeValidationError("Choose a type of account for every selected account.");
      }
      if (!Number.isSafeInteger(account_id) || account_id <= 0 || accountIds.has(account_id) || !Array.isArray(rawLobs) || rawLobs.length > 100) {
        throw new EmployeeValidationError("Please review your account and LOB selections.");
      }
      accountIds.add(account_id);
      const lob_ids = rawLobs.map((lob) => Number(lob));
      if (lob_ids.some((lob) => !Number.isSafeInteger(lob) || lob <= 0) || new Set(lob_ids).size !== lob_ids.length) {
        throw new EmployeeValidationError("Please review your account and LOB selections.");
      }
      return { account_id, account_type, lob_ids };
    });
  }
  return { employee, assignments, phoneNumbers };
}
