"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BriefcaseIcon, EyeIcon, IdentificationIcon, PhoneIcon, UserIcon } from "@heroicons/react/24/outline";
import "./preview.css";

type Field = {
  name: string;
  label: string;
  type?: string;
  wide?: boolean;
  hint?: string;
  placeholder?: string;
  pattern?: string;
  title?: string;
  options?: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
};

type FormDraft = {
  version: 1;
  employeeCode: string;
  existingProfile: boolean;
  activeStep: number;
  values: Record<string, string>;
};

type AccountAssignmentSummary = {
  account_id: string;
  account_label?: string;
  account_type?: string;
  lob_ids: string[];
  lob_options?: { value: string; label: string }[];
};

const draftStorageKey = "ctnp-employee-form-draft-v1";

const steps = [
  {
    title: "Your personal details",
    subtitle: "Please enter your name as it appears on your official records. Fields marked * are required.",
    icon: "01",
    fields: [
      { name: "employee_code", label: "Employee Code", required: true, readOnly: true },
      { name: "first_name", label: "First name", required: true },
      { name: "middle_name", label: "Middle name (optional)" },
      { name: "last_name", label: "Last name", required: true },
      { name: "suffix", label: "Suffix (optional)", placeholder: "N/A", options: [{ value: "JR.", label: "Jr." }, { value: "SR.", label: "Sr." }, { value: "II", label: "II" }, { value: "III", label: "III" }, { value: "IV", label: "IV" }, { value: "V", label: "V" }, { value: "VI", label: "VI" }, { value: "VII", label: "VII" }, { value: "VIII", label: "VIII" }, { value: "IX", label: "IX" }, { value: "X", label: "X" }] },
      { name: "gender", label: "Gender", required: true, options: [{ value: "FEMALE", label: "Female" }, { value: "MALE", label: "Male" }, { value: "NON-BINARY", label: "Non-binary" }, { value: "ANOTHER IDENTITY", label: "Another identity" }, { value: "PREFER NOT TO SAY", label: "Prefer not to say" }] },
      { name: "birthdate", label: "Birth date", type: "date", required: true },
      { name: "age", label: "Age", readOnly: true, hint: "Calculated from your birth date using the company spreadsheet formula." },
      { name: "tax_status_code", label: "Tax Status Code", hint: "Select your marital status for tax records.", required: true, options: [{ value: "SINGLE", label: "Single" }, { value: "MARRIED", label: "Married" }, { value: "WIDOWED", label: "Widowed" }, { value: "LEGALLY SEPARATED", label: "Legally separated" }, { value: "DIVORCED", label: "Divorced" }, { value: "ANNULLED", label: "Annulled" }] },
      { name: "employee_name", label: "Name used in CTNP systems", hint: "This name is filled in automatically from the name fields above.", readOnly: true },
    ],
  },
  {
    title: "Your contact details",
    subtitle: "Share the contact information you would like CTNP to keep on file.",
    icon: "02",
    fields: [
      { name: "contact_number", label: "Primary contact number", type: "tel" },
      { name: "employee_email", label: "Company Gmail", type: "email", placeholder: "your-name.telenet@gmail.com" },
      { name: "personal_email", label: "Personal email", type: "email" },
      { name: "company_email", label: "Company email", type: "email", placeholder: "your-name@cebutele-net.com", pattern: "[^\\s@]+@cebutele-net\\.com", title: "Use your company email ending in @cebutele-net.com." },
      { name: "site", label: "Work site", options: [{ value: "ALABANG", label: "ALABANG" }, { value: "AYALA", label: "AYALA" }, { value: "FAUSTINA", label: "FAUSTINA" }, { value: "USA", label: "USA" }] },
    ],
  },
  {
    title: "Your work details",
    subtitle: "Complete your current work information. Fields marked * are required; Leadership start date is required for Junior Lead.",
    icon: "03",
    fields: [
      { name: "hire_date", label: "Hire date", type: "date", required: true },
      { name: "years_of_service", label: "Years of service", readOnly: true, hint: "Calculated from your hire date using the company spreadsheet formula." },
      { name: "employment_status", label: "Employment status", required: true, options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }] },
      { name: "position_id", label: "Position" },
      { name: "Department", label: "Department" },
      { name: "levels", label: "Level", options: [{ value: "EXECUTIVE", label: "Executive" }, { value: "CORE MANAGER", label: "Core Manager" }, { value: "SENIOR LEAD", label: "Senior Lead" }, { value: "JUNIOR LEAD", label: "Junior Lead" }, { value: "APPRENTICE", label: "Apprentice" }, { value: "SPECIAL OPERATIONS AGENT", label: "Special Operations Agent" }, { value: "AGENT", label: "Agent" }, { value: "L1", label: "L1" }, { value: "L2", label: "L2" }, { value: "L3", label: "L3" }] },
      { name: "shift_type", label: "Shift type", options: [{ value: "DAY SHIFT", label: "Day shift" }, { value: "MID SHIFT", label: "Mid shift" }, { value: "NIGHT SHIFT", label: "Night shift" }] },
      { name: "shift", label: "Shift", placeholder: "9:00 PM - 6:00 AM", hint: "Use the format h:mm AM - h:mm AM if you enter a shift.", pattern: "(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM) - (0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)", title: "Use a format such as 9:00 PM - 6:00 AM." },
    ],
  },
  {
    title: "Government identification",
    subtitle: "Please enter the numbers requested by your HR team, and double-check them before continuing.",
    icon: "04",
    fields: [
      { name: "sss_number", label: "SSS number" },
      { name: "pag_ibig_number", label: "Pag-IBIG number" },
      { name: "tin", label: "TIN" },
      { name: "philhealth", label: "PhilHealth number" },
    ],
  },
  {
    title: "Preview and submit",
    subtitle: "Review your information before submitting the form.",
    icon: "05",
    fields: [],
  },
] satisfies { title: string; subtitle: string; icon: string; fields: Field[] }[];

const addressFields: Field[] = [
  { name: "address_building", label: "Building / Floor" },
  { name: "address_street", label: "Street" },
  { name: "address_barangay", label: "Barangay" },
  { name: "address_city", label: "City / Municipality" },
  { name: "address_province", label: "Province" },
];
const presentAddressFields: Field[] = addressFields.map((field) => ({ ...field, name: field.name.replace(/^address_/, "present_address_") }));
const accountTypeOptions = ["NON-VOICE", "OUTBOUND", "INBOUND", "INBOUND/OUTBOUND", "VOICE", "VOICE - INBOUND", "ADMIN", "N/A"].map((value) => ({ value, label: value }));
function normalizeAccountTypeDraft(value?: string) {
  if (!value) return value;
  try {
    const assignments: unknown = JSON.parse(value);
    if (!Array.isArray(assignments)) return value;
    return JSON.stringify(assignments.map((assignment) => assignment && typeof assignment === "object" && assignment.account_type === "NON VOICE"
      ? { ...assignment, account_type: "NON-VOICE" }
      : assignment));
  } catch { return value; }
}
type AdditionalPhone = { label: string; number: string };
function parseAdditionalPhones(value?: string): AdditionalPhone[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && typeof item.number === "string"))
      .map((item) => ({ label: typeof item.label === "string" && item.label.trim() ? item.label : "OTHER", number: String(item.number) }));
  } catch { return []; }
}
const emergencyContactFields: Field[] = [
  { name: "emergency_contact_name", label: "Emergency contact name" },
  { name: "emergency_contact_relationship", label: "Relationship" },
  { name: "emergency_contact_number", label: "Contact number", type: "tel" },
  { name: "emergency_contact_additional_number", label: "Additional number", type: "tel" },
  { name: "emergency_contact_address", label: "Address", wide: true },
];

function yearsOfService(hireDate: string, currentTime: number | null) {
  if (!hireDate || currentTime === null) return "Enter a hire date to calculate";
  const [year, month, day] = hireDate.split("-").map(Number);
  const hire = new Date(year, month - 1, day);
  if (!year || !month || !day || hire.getFullYear() !== year || hire.getMonth() !== month - 1 || hire.getDate() !== day) {
    return "Enter a valid hire date";
  }
  const years = (currentTime - hire.getTime()) / (365 * 24 * 60 * 60 * 1000);
  if (years < 0) return "Hire date is in the future";
  return `${years.toFixed(3)} years`;
}

function ageInYears(birthDate: string, currentTime: number | null) {
  if (!birthDate || currentTime === null) return "Enter a birth date to calculate";
  const [year, month, day] = birthDate.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  if (!year || !month || !day || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
    return "Enter a valid birth date";
  }
  const years = (currentTime - birth.getTime()) / (365 * 24 * 60 * 60 * 1000);
  if (years < 0) return "Birth date is in the future";
  return `${years.toFixed(2)} years`;
}

function FieldInput({ field, value, onChange, uppercase = true }: { field: Field; value: string; onChange: (value: string) => void; uppercase?: boolean }) {
  const id = `employee-${field.name}`;
  return (
    <label className={`field${field.wide ? " field-wide" : ""}${uppercase ? " uppercase" : ""}`} htmlFor={id}>
      <span className="field-label">{field.label}{field.required && <span className="required-mark"> *</span>}</span>
      {field.options ? (
        <select id={id} name={field.name} value={value} onChange={(event) => onChange(event.target.value)} required={field.required} disabled={field.disabled}>
          <option value="">{field.placeholder ?? "Select an option"}</option>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input id={id} name={field.name} type={field.type ?? "text"} autoCapitalize={field.type === "email" ? "none" : undefined} spellCheck={field.type === "email" ? false : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? (field.type === "number" ? "Enter ID" : `Enter ${field.label.toLowerCase()}`)} required={field.required} disabled={field.disabled} readOnly={field.readOnly} pattern={field.pattern} title={field.title} />
      )}
      {field.hint && <span className="field-hint">{field.hint}</span>}
    </label>
  );
}

function PositionCombobox({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const visibleQuery = open ? query : selectedLabel;
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(visibleQuery.trim().toLowerCase()));

  useEffect(() => {
    if (open) listRef.current?.querySelector(".position-search-option.active")?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function choose(option: { value: string; label: string }) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
    inputRef.current?.setCustomValidity("");
  }

  function restoreSelection() {
    setOpen(false);
    setQuery(selectedLabel);
    inputRef.current?.setCustomValidity("");
  }

  return (
    <div className="field position-search-field">
      <label className="field-label" htmlFor="employee-position-search">Position</label>
      <div className="position-search-control">
        <input
          ref={inputRef}
          id="employee-position-search"
          type="search"
          value={visibleQuery}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="employee-position-options"
          aria-activedescendant={open && filteredOptions[activeIndex] ? `employee-position-option-${filteredOptions[activeIndex].value}` : undefined}
          placeholder="Search or select a position (optional)"
          onFocus={() => { setQuery(selectedLabel); setOpen(true); }}
          onBlur={restoreSelection}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
            if (listRef.current) listRef.current.scrollTop = 0;
            if (!event.target.value) {
              onChange("");
              event.target.setCustomValidity("");
            } else {
              event.target.setCustomValidity("Select a position from the list.");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              if (filteredOptions[activeIndex]) choose(filteredOptions[activeIndex]);
            } else if (event.key === "Escape") {
              event.preventDefault();
              restoreSelection();
            }
          }}
        />
        <button type="button" className="position-search-toggle" aria-label="Show position choices" aria-expanded={open} onMouseDown={(event) => event.preventDefault()} onClick={() => { inputRef.current?.focus(); setQuery(""); setActiveIndex(0); setOpen(true); if (listRef.current) listRef.current.scrollTop = 0; }}>⌄</button>
        {open && <div ref={listRef} id="employee-position-options" className="position-search-options" role="listbox" aria-label="Position choices">
          {value && <button type="button" role="option" aria-selected={false} className="position-search-option" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setQuery(""); setOpen(false); inputRef.current?.setCustomValidity(""); }}>Clear position</button>}
          {filteredOptions.length ? filteredOptions.map((option, index) => (
            <button key={option.value} id={`employee-position-option-${option.value}`} type="button" role="option" aria-selected={option.value === value} className={index === activeIndex ? "position-search-option active" : "position-search-option"} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}>{option.label}</button>
          )) : <div className="position-search-empty">No matching positions. Clear the search and choose Other to type a new title.</div>}
        </div>}
      </div>
    </div>
  );
}

export default function Home() {
  const [now, setNow] = useState<number | null>(null);
  const [codeChecked, setCodeChecked] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [detectedAssignments, setDetectedAssignments] = useState<AccountAssignmentSummary[]>([]);
  const [existingProfile, setExistingProfile] = useState(false);
  const [lookupToken, setLookupToken] = useState("");
  const [savedOptions, setSavedOptions] = useState<Record<string, { value: string; label: string }>>({});
  const [accountOptions, setAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const [lobsByAccount, setLobsByAccount] = useState<Record<string, { value: string; label: string }[]>>({});
  const [positionOptions, setPositionOptions] = useState<{ value: string; label: string }[]>([]);
  const checkingCode = useRef(false);
  const [activeStep, setActiveStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const submitting = useRef(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [draftPhotoFile, setDraftPhotoFile] = useState<File | null>(null);
  const [draftPhotoPreview, setDraftPhotoPreview] = useState("");
  const [photoZoom, setPhotoZoom] = useState(1);
  const [draftReady, setDraftReady] = useState(false);
  const pendingDraft = useRef<FormDraft | null>(null);

  useEffect(() => {
    const refreshNow = () => setNow(Date.now());
    refreshNow();
    const interval = window.setInterval(refreshNow, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const loadFormOptions = async () => {
      try {
        const [accountsResponse, lobsResponse, positionsResponse] = await Promise.all([
          fetch("/api/accounts", { cache: "no-store" }),
          fetch("/api/lobs", { cache: "no-store" }),
          fetch("/api/positions", { cache: "no-store" }),
        ]);
        if (accountsResponse.ok) {
          const result = await accountsResponse.json();
          if (active && Array.isArray(result.options)) setAccountOptions((current) => {
            const merged = new Map(current.map((option: { value: string; label: string }) => [option.value, option]));
            for (const option of result.options) merged.set(option.value, option);
            return [...merged.values()];
          });
        }
        if (lobsResponse.ok) {
          const result = await lobsResponse.json();
          if (active && result.options && typeof result.options === "object") setLobsByAccount((current) => {
            const merged = { ...current };
            for (const [accountId, options] of Object.entries(result.options) as [string, { value: string; label: string }[]][]) {
              const accountOptions = new Map((merged[accountId] ?? []).map((option) => [option.value, option]));
              for (const option of options) accountOptions.set(option.value, option);
              merged[accountId] = [...accountOptions.values()];
            }
            return merged;
          });
        }
        if (positionsResponse.ok) {
          const result = await positionsResponse.json();
          if (active && Array.isArray(result.options)) setPositionOptions(result.options);
        }
      } catch {
        // Keep the current options and retry on the next refresh.
      }
    };
    void loadFormOptions();
    const interval = window.setInterval(loadFormOptions, 30_000);
    window.addEventListener("focus", loadFormOptions);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadFormOptions);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const restoreDraft = async () => {
      try {
        const saved = localStorage.getItem(draftStorageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved) as Partial<FormDraft>;
        if (parsed.version !== 1 || typeof parsed.employeeCode !== "string" || parsed.employeeCode.length > 100
          || typeof parsed.existingProfile !== "boolean" || !Number.isInteger(parsed.activeStep)
          || (parsed.activeStep as number) < 0 || (parsed.activeStep as number) >= steps.length
          || !parsed.values || typeof parsed.values !== "object" || Array.isArray(parsed.values)
          || parsed.values.employee_code !== parsed.employeeCode
          || Object.values(parsed.values).some((value) => typeof value !== "string" || value.length > 1000)) {
          try { localStorage.removeItem(draftStorageKey); } catch {}
          return;
        }
        const draft = parsed as FormDraft;
        pendingDraft.current = draft;
        setEmployeeCode(draft.employeeCode);
        if (active) await checkEmployeeCode(draft.employeeCode, draft);
      } catch {
        try { localStorage.removeItem(draftStorageKey); } catch {}
      } finally {
        if (active) setDraftReady(true);
      }
    };
    void restoreDraft();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (submitted || (viewOnly && codeChecked) || (!codeChecked && !pendingDraft.current) || (codeChecked && !values.employee_code)) {
      try { localStorage.removeItem(draftStorageKey); } catch {}
      return;
    }
    if (!codeChecked) return;
    const draft: FormDraft = {
      version: 1,
      employeeCode: values.employee_code,
      existingProfile,
      activeStep,
      values,
    };
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // A full or unavailable browser storage must not interrupt form entry.
    }
  }, [draftReady, codeChecked, submitted, viewOnly, values, existingProfile, activeStep, employeeCode]);

  const step = steps[activeStep];
  const progress = ((activeStep + 1) / steps.length) * 100;
  const previewSections = [
    { title: steps[0].title, icon: UserIcon, index: 0, fields: steps[0].fields },
    { title: steps[1].title, icon: PhoneIcon, index: 1, fields: [steps[1].fields[0], { name: "additional_contact_numbers", label: "Additional contact numbers" }, ...steps[1].fields.slice(1), { name: "address", label: "Home address" }, { name: "present_address", label: "Present address" }, ...emergencyContactFields, { name: "photo", label: "Profile photo" }] },
    { title: steps[2].title, icon: BriefcaseIcon, index: 2, fields: [...steps[2].fields.filter((field) => field.name !== "shift"), { name: "account_lob_assignments", label: "Accounts and LOBs" }, ...(values.hire_date_leader ? [{ name: "hire_date_leader", label: "Leadership start date" }] : []), steps[2].fields.find((field) => field.name === "shift")!] },
    { title: steps[3].title, icon: IdentificationIcon, index: 3, fields: steps[3].fields },
  ];
  const selectedPosition = positionOptions.find((option) => option.value === values.position_id)
    ?? (savedOptions.position_id?.value === values.position_id ? savedOptions.position_id : undefined);
  const isOtherPosition = selectedPosition?.label.trim().toUpperCase() === "OTHER";

  async function checkEmployeeCode(codeToCheck = employeeCode, restoredDraft?: FormDraft) {
    if (checkingCode.current) return;
    const draftToRestore = restoredDraft ?? pendingDraft.current;
    checkingCode.current = true;
    setLookupLoading(true);
    setLookupError("");
    try {
      const response = await fetch("/api/employees/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: codeToCheck.trim().toUpperCase() }),
      });
      const result = await response.json().catch(() => null);
      if (!result || !response.ok) throw new Error(result?.error || "Your Employee Code could not be checked. Please try again.");
      const loadedValues = result.found ? result.values : { employee_code: result.employeeCode };
      const restoredValues = draftToRestore ? { ...loadedValues, ...draftToRestore.values } : loadedValues;
      if (restoredValues.account_lob_assignments) {
        restoredValues.account_lob_assignments = normalizeAccountTypeDraft(restoredValues.account_lob_assignments);
      }
      setValues(restoredValues);
      setExistingProfile(Boolean(result.found));
      const savedAssignments = Array.isArray(result.assignments) ? result.assignments as AccountAssignmentSummary[] : [];
      setDetectedAssignments(savedAssignments);
      setShowLookupModal(!draftToRestore);
      setLookupToken(result.lookupToken || "");
      setSavedOptions(result.options || {});
      if (Array.isArray(result.assignments)) {
        setAccountOptions((current) => {
          const merged = new Map(current.map((option: { value: string; label: string }) => [option.value, option]));
          for (const assignment of result.assignments) {
            if (assignment.account_id && assignment.account_label) merged.set(String(assignment.account_id), { value: String(assignment.account_id), label: String(assignment.account_label) });
          }
          return [...merged.values()];
        });
        setLobsByAccount((current) => {
          const merged = { ...current };
          for (const assignment of result.assignments) {
            if (!assignment.account_id || !Array.isArray(assignment.lob_options)) continue;
            const options = new Map((merged[String(assignment.account_id)] ?? []).map((option) => [option.value, option]));
            for (const lob of assignment.lob_options) options.set(String(lob.value), { value: String(lob.value), label: String(lob.label) });
            merged[String(assignment.account_id)] = [...options.values()];
          }
          return merged;
        });
      }
      setPhotoFile(null);
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(result.found ? result.values.avatar_url || "" : "");
      cancelPhoto();
      setActiveStep(draftToRestore?.activeStep ?? (result.found ? steps.length - 1 : 0));
      setViewOnly(Boolean(result.found && !draftToRestore));
      pendingDraft.current = null;
      setSubmitted(false);
      setSubmissionError("");
      setCodeChecked(true);
    } catch (error) {
      setLookupError(error instanceof TypeError ? "Unable to connect. Please try again." : error instanceof Error ? error.message : "Your Employee Code could not be checked. Please try again.");
    } finally {
      checkingCode.current = false;
      setLookupLoading(false);
    }
  }

  function previewValue(name: string) {
    if (name === "photo") return photoFile?.name ?? "Not provided";
    if (name === "additional_contact_numbers") return parseAdditionalPhones(values.additional_contact_numbers)
      .map((phone) => phone.number)
      .join("; ") || "Not provided";
    if (name === "years_of_service") return yearsOfService(values.hire_date ?? "", now);
    if (name === "age") return ageInYears(values.birthdate ?? "", now);
    if (name === "account_lob_assignments") {
      try {
        const assignments = JSON.parse(values.account_lob_assignments || "[]") as { account_id: string; account_type?: string; lob_ids: string[] }[];
        const labels = assignments.flatMap((assignment) => {
          const account = accountOptions.find((option) => option.value === assignment.account_id)?.label ?? assignment.account_id;
          const lobs = (lobsByAccount[assignment.account_id] ?? []).filter((option) => assignment.lob_ids.includes(option.value)).map((option) => option.label);
          return [`${account}${assignment.account_type ? ` (${assignment.account_type})` : ""}${lobs.length ? `: ${lobs.join(", ")}` : ""}`];
        });
        return labels.join("; ") || "Not provided";
      } catch { return "Not provided"; }
    }
    const value = values[name];
    if (!value) return "Not provided";
    if (name === "position_id") return isOtherPosition
      ? `Other: ${values.position_other?.trim() || "Not provided"}`
      : selectedPosition?.label ?? value;
    for (const section of steps) {
      const field: Field | undefined = section.fields.find((candidate) => candidate.name === name);
      const option = field?.options?.find((candidate) => candidate.value === value);
      if (option) return option.label;
    }
    if (savedOptions[name]?.value === value) return savedOptions[name].label;
    return value;
  }

  function update(name: string, value: string) {
    setValues((current) => {
      const emailFields = ["employee_email", "personal_email", "company_email"];
      const next = { ...current, [name]: emailFields.includes(name) || name === "vici_link" || name === "account_lob_assignments" || name === "additional_contact_numbers" ? value : value.toUpperCase() };
      if (["first_name", "middle_name", "last_name", "suffix"].includes(name)) {
        next.employee_name = [next.first_name, next.middle_name, next.last_name, next.suffix]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ");
      }
      if (name.startsWith("address_")) {
        next.address_edited = "true";
        next.address = ["address_building", "address_street", "address_barangay", "address_city", "address_province"]
          .map((part) => next[part]?.trim())
          .filter(Boolean)
          .join(", ");
      }
      if (name.startsWith("present_address_")) {
        next.present_address_edited = "true";
        next.present_address = ["present_address_building", "present_address_street", "present_address_barangay", "present_address_city", "present_address_province"]
          .map((part) => next[part]?.trim()).filter(Boolean).join(", ");
      }
      if (name === "present_address_same_as_home") {
        const checked = value.toUpperCase() === "TRUE";
        next.present_address_same_as_home = checked ? "TRUE" : "FALSE";
        if (checked) next.present_address = next.address || "";
        else next.present_address = "";
      }
      if (name === "levels" && value.toUpperCase() !== "JUNIOR LEAD") {
        delete next.hire_date_leader;
      }
      return next;
    });
    setSubmitted(false);
    setSubmissionError("");
  }

  function goToStep(index: number) {
    if (saving || submitted) return;
    if (index <= activeStep) {
      setActiveStep(index);
      setSubmitted(false);
      setSubmissionError("");
    }
  }

  function continueAfterLookup() {
    setShowLookupModal(false);
  }

  function closeLookupModal() {
    setShowLookupModal(false);
    setCodeChecked(false);
    setViewOnly(false);
    setLookupToken("");
  }

  function editProfile() {
    setViewOnly(false);
    setSubmitted(false);
    if (!lookupToken) {
      setEmployeeCode(values.employee_code || "");
      setCodeChecked(false);
    }
  }

  async function finish() {
    if (submitting.current || submitted) return;
    submitting.current = true;
    setSaving(true);
    setSubmissionError("");
    try {
      const payload = new FormData();
      payload.set("values", JSON.stringify(values));
      if (lookupToken) payload.set("lookupToken", lookupToken);
      if (photoFile) payload.set("photo", photoFile);
      const response = await fetch("/api/employees", { method: "POST", body: payload });
      const result = await response.json().catch(() => null);
      if (!result) throw new Error("Your submission could not be confirmed. Your answers are still here; please try again.");
      if (!response.ok) throw new Error(result.error || "Your information could not be saved. Please try again.");
      if (!result.employeeId) throw new Error("We could not confirm your submission. Please contact HR.");
      if (typeof result.lookupToken === "string") setLookupToken(result.lookupToken);
      setEmployeeCode(values.employee_code);
      setExistingProfile(true);
      setSubmitted(true);
      setViewOnly(true);
      setShowSuccessModal(true);
    } catch (error) {
      setSubmissionError(error instanceof TypeError ? "Unable to connect. Your answers are still here; please try again." : error instanceof Error ? error.message : "Your information could not be saved. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function choosePhoto(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (draftPhotoPreview) URL.revokeObjectURL(draftPhotoPreview);
    setDraftPhotoFile(file);
    setDraftPhotoPreview(URL.createObjectURL(file));
    setPhotoZoom(1);
  }

  function cancelPhoto() {
    if (draftPhotoPreview) URL.revokeObjectURL(draftPhotoPreview);
    setDraftPhotoFile(null);
    setDraftPhotoPreview("");
  }

  async function confirmPhoto() {
    if (!draftPhotoFile || !draftPhotoPreview) return;
    const image = new Image();
    image.src = draftPhotoPreview;
    await image.decode();
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / photoZoom;
    const sourceX = (image.naturalWidth - cropSize) / 2;
    const sourceY = (image.naturalHeight - cropSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    canvas.getContext("2d")?.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 512, 512);
    const croppedBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, draftPhotoFile.type));
    if (!croppedBlob) return;
    const croppedFile = new File([croppedBlob], draftPhotoFile.name, { type: draftPhotoFile.type });
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(croppedFile);
    setPhotoPreview(URL.createObjectURL(croppedFile));
    cancelPhoto();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="CTNP People home">
          <img className="brand-logo" src="/ctnp-logo.png" alt="" width="38" height="38" />
          <span>CTNP <b>People</b></span>
        </a>
        <div className="topbar-right"><span className="secure-dot" /> Employee records <span className="topbar-divider">·</span> New profile</div>
      </header>

      <section className="page-content" id="home">
        <div className="intro">
          <div className="eyebrow"><span /> PEOPLE OPERATIONS</div>
          <h1>Employee Information</h1>
          <p>{viewOnly ? "Review the saved profile below. Select Edit profile if you need to make changes." : codeChecked ? "Please complete each section with your information. You can go back to review your answers." : "Enter your Employee Code to check for a saved profile before you begin."}</p>
        </div>

        <section className="form-card" aria-label="New employee form">
          {!codeChecked ? (
            <form className="employee-code-form" aria-busy={lookupLoading} onSubmit={(event) => { event.preventDefault(); void checkEmployeeCode(); }}>
              <div className="form-heading"><div className="heading-icon">01</div><div><h2>Start with your Employee Code</h2><p>We will load your saved information if your profile already exists.</p></div></div>
              <div className="employee-code-entry">
                <FieldInput field={{ name: "lookup_code", label: "Employee Code", required: true, disabled: lookupLoading, placeholder: "Enter your Employee Code" }} value={employeeCode} onChange={(value) => { if (pendingDraft.current && value.toUpperCase() !== pendingDraft.current.employeeCode) pendingDraft.current = null; setEmployeeCode(value.toUpperCase()); setLookupError(""); }} />
                <button type="submit" className="next-button" disabled={lookupLoading}>{lookupLoading ? "Checking…" : "Check Employee Code"}</button>
              </div>
              <p className="employee-code-help">If no saved profile is found, you can complete a new employee profile.</p>
              {lookupError && <div className="notice" role="alert"><span>!</span><div><strong>Unable to check your code</strong><p>{lookupError}</p></div></div>}
            </form>
          ) : (<>
          {!viewOnly && <div className="progress-area">
            <div className="step-track" aria-label={`Step ${activeStep + 1} of ${steps.length}`}>
              <div className="track-line"><span style={{ width: `${progress}%` }} /></div>
              {steps.map((item, index) => (
                <button type="button" className={`track-step${index === activeStep ? " current" : ""}${index < activeStep ? " complete" : ""}`} key={item.title} onClick={() => goToStep(index)} disabled={index > activeStep || saving || submitted} aria-current={index === activeStep ? "step" : undefined}>
                  <span className="step-dot">{index < activeStep ? "✓" : item.icon}</span>
                  <span className="step-name">{item.title}</span>
                </button>
              ))}
            </div>
            <div className="step-count">STEP {String(activeStep + 1).padStart(2, "0")} <span>OF {String(steps.length).padStart(2, "0")}</span></div>
          </div>}

          <form className={viewOnly ? "employee-view-form" : undefined} aria-busy={saving} onSubmit={(event) => { event.preventDefault(); if (viewOnly) return; if (activeStep < steps.length - 1) { setActiveStep(activeStep + 1); setSubmitted(false); setSubmissionError(""); } else { void finish(); } }}>
            <div className="form-heading">
              <div className="heading-icon">{viewOnly ? "✓" : step.icon}</div>
              <div><h2>{viewOnly ? "Employee profile" : step.title}</h2><p>{viewOnly ? "Saved information · view only" : step.subtitle}</p></div>
            </div>
            <div className={`employee-code-context${viewOnly ? " employee-code-context-view" : ""}`}>
              <div><strong>Employee Code: {values.employee_code}</strong><span className={existingProfile ? undefined : "employee-code-context-empty"}>{viewOnly ? (lookupToken ? "Saved profile loaded. Select Edit profile to make changes." : "Your profile was saved. Check the Employee Code again before editing.") : existingProfile ? "Saved profile loaded. Review and update your information." : "No saved profile found. Complete your information below."}</span></div>
              <button type="button" disabled={saving} onClick={() => { setEmployeeCode(values.employee_code || ""); setLookupError(""); setShowLookupModal(false); setViewOnly(false); setCodeChecked(false); }}>Change Employee Code</button>
            </div>
            {viewOnly && <div className="employee-view-actions"><span><EyeIcon className="employee-view-icon" aria-hidden="true" />View only</span><button type="button" className="next-button" onClick={editProfile}>{lookupToken ? "Edit profile" : "Check code to edit"}</button></div>}

            {activeStep === steps.length - 1 ? (
              <div className="employee-preview-content">
                <section className="employee-preview-hero" aria-label="Employee profile preview">
                  <div className="employee-preview-avatar">{photoPreview ? <img src={photoPreview} alt="Employee profile" /> : (values.first_name?.[0] ?? "E") + (values.last_name?.[0] ?? "")}</div>
                  <div className="employee-preview-identity">
                    <span className="employee-preview-kicker">{viewOnly ? "EMPLOYEE PROFILE" : "EMPLOYEE PROFILE PREVIEW"}</span>
                    <h3>{values.employee_name || "YOUR NAME WILL APPEAR HERE"}</h3>
                    <div className="employee-preview-meta">
                      <p><strong>Position:</strong> {previewValue("position_id")}</p>
                      <p><strong>Department:</strong> {previewValue("Department")}</p>
                    </div>
                  </div>
                  <span className="employee-preview-employeeId"><small>EMPLOYEE CODE</small>{previewValue("employee_code")}</span>
                </section>
                {previewSections.map((section) => (
                  <section className="employee-preview-section" key={section.title}>
                    <div className="employee-preview-sectionHeading"><h3><section.icon className="employee-preview-sectionIcon" aria-hidden="true" />{section.title}</h3>{!viewOnly && <button type="button" disabled={saving || submitted} onClick={() => goToStep(section.index)}>Edit</button>}</div>
                    <dl className="employee-preview-grid">
                      {section.fields.filter((field) => field.name !== "employee_name" && field.name !== "photo").map((field) => (
                        <div className="employee-preview-item" key={field.name}>
                          <dt>{field.label}</dt>
                          <dd>{field.name === "address" ? (values.address || "Not provided") : field.name === "present_address" && values.present_address_same_as_home === "TRUE" ? (values.address || "Same as home address") : previewValue(field.name)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
                {!submitted && !viewOnly && <div className="review-panel">
                  <div className="review-icon">✓</div>
                  <div><strong>Review complete?</strong><p>Check your details above, then select Submit. You can edit any section before continuing.</p></div>
                </div>}
              </div>
            ) : (
            <div className="fields-grid">
              {activeStep === 2 && <section className="field-wide assignment-section" aria-labelledby="assignments-heading">
                <div className="assignment-heading"><div className="assignment-title-row"><span className="field-label" id="assignments-heading">Accounts and LOBs</span><span className="optional-text">Optional</span></div><span className="field-hint">Choose one or more accounts. LOBs are optional for each account.</span></div>
                <div className="account-list">{accountOptions.map((account) => {
                  let assignments: { account_id: string; account_type?: string; lob_ids: string[] }[] = [];
                  try { assignments = JSON.parse(values.account_lob_assignments || "[]"); } catch {}
                  const selected = assignments.find((assignment) => assignment.account_id === account.value);
                  const accountLobs = lobsByAccount[account.value] ?? [];
                  const setAssignments = (lobIds: string[]) => {
          const next = assignments.filter((assignment) => assignment.account_id !== account.value);
                    if (selected || lobIds.length) next.push({ ...selected, account_id: account.value, lob_ids: lobIds });
                    update("account_lob_assignments", JSON.stringify(next));
                  };
                  const setAccountType = (account_type: string) => update("account_lob_assignments", JSON.stringify(assignments.map((assignment) => assignment.account_id === account.value ? { ...assignment, account_type } : assignment)));
                  return <section className={`account-card${selected ? " account-card-selected" : ""}`} key={account.value}>
                    <label className="check-row account-check"><input type="checkbox" checked={Boolean(selected)} onChange={(event) => {
                      if (event.target.checked) update("account_lob_assignments", JSON.stringify([...assignments, { account_id: account.value, lob_ids: [] }]));
                      else update("account_lob_assignments", JSON.stringify(assignments.filter((assignment) => assignment.account_id !== account.value)));
                    }} /><span>{account.label}</span></label>
                    {selected && <div className="lob-list" aria-label={`${account.label} assignment details`}>
                      <FieldInput field={{ name: `account_type_${account.value}`, label: "Type of account", required: true, options: accountTypeOptions }} value={selected.account_type ?? ""} onChange={setAccountType} />
                      {accountLobs.length > 1 && <label className="check-row select-all-lobs"><input type="checkbox" checked={accountLobs.every((lob) => selected.lob_ids.includes(lob.value))} onChange={(event) => setAssignments(event.target.checked ? accountLobs.map((lob) => lob.value) : [])} /><span>Select all LOBs</span></label>}
                      {accountLobs.map((lob) => <label className="check-row" key={lob.value}><input type="checkbox" checked={selected.lob_ids.includes(lob.value)} onChange={(event) => setAssignments(event.target.checked ? [...new Set([...selected.lob_ids, lob.value])] : selected.lob_ids.filter((id) => id !== lob.value))} /><span>{lob.label}</span></label>)}
                      {accountLobs.length === 0 && <span className="field-hint">No LOBs are currently available for this account.</span>}
                    </div>}
                  </section>;
                })}</div>
              </section>}
              {step.fields.flatMap((field) => {
                if (field.name === "age") return [<label className="field" htmlFor="employee-age" key={field.name}><span className="field-label">{field.label}</span><input id="employee-age" className="calculated-display" type="text" value={ageInYears(values.birthdate ?? "", now)} readOnly /><span className="field-hint">Calculated from your birth date using the company spreadsheet formula.</span></label>];
                if (field.name === "years_of_service") return [<label className="field" htmlFor="employee-years-of-service" key={field.name}><span className="field-label">{field.label}</span><input id="employee-years-of-service" className="calculated-display" type="text" value={yearsOfService(values.hire_date ?? "", now)} readOnly /><span className="field-hint">Calculated from your hire date using the company spreadsheet formula.</span></label>];
                let configuredField: Field = field.name === "position_id"
                  ? { ...field, options: positionOptions }
                  : field;
                const savedOption = savedOptions[field.name];
                if (configuredField.options && savedOption && savedOption.value === values[field.name]
                  && !configuredField.options.some((option) => option.value === savedOption.value)
                  && (field.name !== "lob_id" || savedOptions.account_id?.value === values.account_id)) {
                  configuredField = { ...configuredField, options: [...configuredField.options, savedOption] };
                }
                const fieldInput = field.name === "position_id"
                  ? <PositionCombobox key={field.name} options={configuredField.options ?? []} value={values.position_id ?? ""} onChange={(value) => update("position_id", value)} />
                  : <FieldInput key={field.name} field={configuredField} value={values[field.name] ?? ""} onChange={(value) => update(field.name, value)} uppercase={field.type !== "url" && !(activeStep === 1 && ["employee_email", "personal_email", "company_email"].includes(field.name))} />;
                if (activeStep === 1 && field.name === "contact_number") {
                  const phones = parseAdditionalPhones(values.additional_contact_numbers);
                  const setPhones = (next: AdditionalPhone[]) => update("additional_contact_numbers", JSON.stringify(next));
                  return [fieldInput, <section className="field-wide additional-phones" aria-labelledby="additional-phones-heading" key="additional-phones">
                    <div className="additional-phones-heading"><div><span className="field-label" id="additional-phones-heading">Additional contact numbers</span><span className="field-hint">Optional. Add another number you can be reached on.</span></div><button type="button" className="back-button" disabled={phones.length >= 5} onClick={() => setPhones([...phones, { label: "OTHER", number: "" }])}>+ Add another number</button></div>
                    {phones.map((phone, index) => <div className="additional-phone-row" key={index}>
                      <FieldInput field={{ name: `additional_phone_number_${index}`, label: `Additional number ${index + 1}`, type: "tel", required: true, placeholder: "Enter another number" }} value={phone.number} onChange={(number) => setPhones(phones.map((item, itemIndex) => itemIndex === index ? { ...item, number } : item))} />
                      <button type="button" className="additional-phone-remove" aria-label={`Remove additional number ${index + 1}`} onClick={() => setPhones(phones.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                    </div>)}
                  </section>];
                }
                if (activeStep === 2 && field.name === "position_id" && isOtherPosition) {
                  return [fieldInput, <FieldInput key="position_other" field={{ name: "position_other", label: "Type your position", required: true, placeholder: "Enter your position" }} value={values.position_other ?? ""} onChange={(value) => update("position_other", value)} />];
                }
                if (activeStep === 2 && field.name === "levels" && (values.levels === "JUNIOR LEAD" || values.hire_date_leader)) {
                  return [fieldInput, <FieldInput key="hire_date_leader" field={{ name: "hire_date_leader", label: "Leadership start date", type: "date", required: values.levels === "JUNIOR LEAD" }} value={values.hire_date_leader ?? ""} onChange={(value) => update("hire_date_leader", value)} />];
                }
                return [fieldInput];
              })}
              {activeStep === 1 && (
                <>
                  <section className="field-wide address-section" aria-labelledby="home-address-heading">
                    <div className="address-heading">
                      <span className="field-label" id="home-address-heading">Home address</span>
                      <span className="field-hint">Optional. Your address will be combined for your employee record.</span>
                    </div>
                    {values.address && values.address_edited !== "true" && <div className="employee-saved-address"><strong>Address on file</strong><p>{values.address}</p><span>To replace this address, complete the fields below.</span></div>}
                    <div className="address-grid">
                      {addressFields.map((field) => <FieldInput key={field.name} field={field} value={values[field.name] ?? ""} onChange={(value) => update(field.name, value)} />)}
                    </div>
                  </section>
                  <section className="field-wide address-section" aria-labelledby="present-address-heading">
                    <div className="address-heading">
                      <span className="field-label" id="present-address-heading">Present address</span>
                      <span className="field-hint">Optional. Enter where you currently live.</span>
                    </div>
                    <label className="check-row address-same-check"><input type="checkbox" checked={values.present_address_same_as_home === "TRUE"} onChange={(event) => update("present_address_same_as_home", event.target.checked ? "true" : "false")} /><span>Present address is the same as home address</span></label>
                    {values.present_address_same_as_home === "TRUE"
                      ? <div className="employee-saved-address"><strong>Using home address</strong><p>{values.address || "Enter your home address above."}</p></div>
                      : <div className="address-grid">{presentAddressFields.map((field) => <FieldInput key={field.name} field={field} value={values[field.name] ?? ""} onChange={(value) => update(field.name, value)} />)}</div>}
                  </section>
                  <section className="field-wide address-section emergency-contact-section" aria-labelledby="emergency-contact-heading">
                    <div className="address-heading"><span className="field-label" id="emergency-contact-heading">Emergency contact</span><span className="field-hint">Optional. Add someone we can contact in an emergency.</span></div>
                    <div className="address-grid">{emergencyContactFields.map((field) => <FieldInput key={field.name} field={field} value={values[field.name] ?? ""} onChange={(value) => update(field.name, value)} />)}</div>
                  </section>
                  <section className="field field-wide photo-field" aria-labelledby="photo-upload-heading">
                    <span className="field-label" id="photo-upload-heading">Upload photo <span className="optional-text">(optional)</span></span>
                    <div className="photo-upload-row">
                      {photoPreview && <img className="photo-thumb" src={photoPreview} alt="Selected employee photo" />}
                      <div className="photo-upload-copy">
                        <label className="upload-button" htmlFor="employee-photo-upload">{photoPreview ? "Change photo" : "Choose photo"}</label>
                        <span className="field-hint">JPG, PNG, or WEBP, up to 5 MB. You can adjust the crop before using it.</span>
                        {photoFile && <span className="photo-filename">{photoFile.name}</span>}
                      </div>
                      <input id="employee-photo-upload" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { choosePhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
                    </div>
                  </section>
                </>
              )}
            </div>
            )}
            {submissionError && <div className="notice" role="alert"><span>!</span><div><strong>Submission could not be completed</strong><p>{submissionError}</p></div></div>}
            {!viewOnly && <div className="form-footer">
              <span className="save-note"><span className="save-icon">▣</span> Draft saved in this browser</span>
              <div className="actions">
                {activeStep > 0 && !submitted && <button type="button" className="back-button" disabled={saving} onClick={() => goToStep(activeStep - 1)}>← <span>Back</span></button>}
                <button className="next-button" type="submit" disabled={saving || submitted}>{submitted ? "Saved" : saving ? "Saving…" : activeStep === steps.length - 1 ? existingProfile ? "Save changes" : "Submit" : "Continue"}{!saving && !submitted && <span>→</span>}</button>
              </div>
            </div>}
          </form>
          </>)}
        </section>
        <footer className="page-footer"><span>CTNP SYSTEM</span><span>EMPLOYEE PROFILE</span></footer>
      </section>
      {showLookupModal && createPortal((
        <div className="modal-backdrop lookup-modal-backdrop">
          <section className="lookup-modal" role="dialog" aria-modal="true" aria-labelledby="lookup-modal-title" aria-describedby="lookup-modal-description">
            <button type="button" className="modal-close lookup-modal-close" aria-label="Close account popup" onClick={closeLookupModal}>×</button>
            <div className={`lookup-modal-mark${existingProfile ? " lookup-modal-mark-found" : ""}`} aria-hidden="true">{existingProfile ? "✓" : "i"}</div>
            <h2 id="lookup-modal-title">{existingProfile ? detectedAssignments.length ? "Account detected" : "Employee ID found" : "No account exists yet"}</h2>
            {existingProfile && values.employee_name && <p className="lookup-employee-name">{values.employee_name}</p>}
            <p id="lookup-modal-description">{existingProfile
              ? detectedAssignments.length
                ? "We found this Employee ID and its saved account assignment in the database."
                : "We found this Employee ID, but there is no account linked to the saved profile yet."
              : "There is no saved employee profile or account linked to this Employee ID. You can create a new profile now."}</p>
            {detectedAssignments.length > 0 && <ul className="lookup-account-list">
              {detectedAssignments.map((assignment) => <li key={assignment.account_id}>
                <strong>{assignment.account_label || `Account ${assignment.account_id}`}</strong>
                <span>{assignment.lob_options?.map((lob) => lob.label).join(", ") || assignment.lob_ids.join(", ") || "No LOB selected"}</span>
              </li>)}
            </ul>}
            <button type="button" className="next-button lookup-modal-action" autoFocus onClick={continueAfterLookup}>
              {existingProfile ? detectedAssignments.length ? "Load saved profile" : "Continue and add account" : "Create new profile"}<span aria-hidden="true">→</span>
            </button>
          </section>
        </div>
      ), document.body)}
      {showSuccessModal && createPortal((
        <div className="modal-backdrop lookup-modal-backdrop" role="presentation">
          <section className="lookup-modal" role="dialog" aria-modal="true" aria-labelledby="success-modal-title" aria-describedby="success-modal-description">
            <button type="button" className="modal-close lookup-modal-close" aria-label="Close success message" onClick={() => setShowSuccessModal(false)}>×</button>
            <div className="lookup-modal-mark lookup-modal-mark-found" aria-hidden="true">✓</div>
            <h2 id="success-modal-title">Information saved successfully</h2>
            <p id="success-modal-description">Thank you! Your employee information has been saved.</p>
            <button type="button" className="next-button lookup-modal-action" autoFocus onClick={() => setShowSuccessModal(false)}>Done</button>
          </section>
        </div>
      ), document.body)}
      {draftPhotoPreview && createPortal((
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelPhoto(); }}>
          <section className="photo-modal" role="dialog" aria-modal="true" aria-labelledby="photo-modal-title">
            <div className="photo-modal-header">
              <div><h2 id="photo-modal-title">Adjust your photo</h2><p>Move closer or farther away to frame your photo.</p></div>
              <button type="button" className="modal-close" aria-label="Close photo preview" onClick={cancelPhoto}>×</button>
            </div>
            <div className="photo-crop-window"><img src={draftPhotoPreview} alt="Photo crop preview" style={{ transform: `scale(${photoZoom})` }} /></div>
            <label className="zoom-control" htmlFor="photo-zoom"><span>Zoom</span><input id="photo-zoom" type="range" min="1" max="2.5" step="0.05" value={photoZoom} onChange={(event) => setPhotoZoom(Number(event.target.value))} /><output>{photoZoom.toFixed(1)}×</output></label>
            <div className="photo-modal-actions">
              <button type="button" className="back-button" onClick={cancelPhoto}>Cancel</button>
              <button type="button" className="next-button" onClick={confirmPhoto}>Use this photo<span>→</span></button>
            </div>
          </section>
        </div>
      ), document.body)}
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    </main>
  );
}
