/**
 * TEMPORARY credential scheme until employees set their own passwords:
 * the password is the employee code. The login email is the first email
 * on file (personal, then employee, then company); employees with no
 * email on file get a deterministic synthetic login email so every
 * existing employee record can sign in without any database change.
 * Codes shorter than the auth provider's 6-character minimum are doubled
 * to pass policy (deterministic on both sides). Remove this module when
 * self-chosen passwords ship.
 */
export function temporaryPasswordFor(employeeCode: string) {
  const code = employeeCode.trim().toUpperCase();
  return code.length >= 6 ? code : `${code}${code}`;
}

export function syntheticLoginEmail(employeeCode: string) {
  return `${employeeCode.trim().toUpperCase()}@ctnp.local`;
}

export function isSyntheticLoginEmail(email: string) {
  return /@ctnp\.local$/i.test(email.trim());
}

export function resolveLoginEmail(employee: {
  personal_email?: string | null;
  employee_email?: string | null;
  company_email?: string | null;
  employee_code: string;
}) {
  const onFile = [employee.personal_email, employee.employee_email, employee.company_email]
    .map((value) => (value ?? "").trim().toLowerCase())
    .find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  return onFile ?? syntheticLoginEmail(employee.employee_code);
}
