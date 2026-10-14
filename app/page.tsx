"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      { name: "suffix", label: "Suffix (optional)", hint: "Jr., III, etc." },
      { name: "gender", label: "Gender", required: true, options: [{ value: "FEMALE", label: "Female" }, { value: "MALE", label: "Male" }, { value: "NON-BINARY", label: "Non-binary" }, { value: "ANOTHER IDENTITY", label: "Another identity" }, { value: "PREFER NOT TO SAY", label: "Prefer not to say" }] },
      { name: "birthdate", label: "Birth date", type: "date", required: true },
      { name: "employee_name", label: "Name used in CTNP systems", hint: "This name is filled in automatically from the name fields above.", readOnly: true },
    ],
  },
  {
    title: "Your contact details",
    subtitle: "Share the contact information you would like CTNP to keep on file.",
    icon: "02",
    fields: [
      { name: "contact_number", label: "Contact number", type: "tel", required: true },
      { name: "employee_email", label: "Company Gmail", type: "email", placeholder: "your-name.telenet@gmail.com", required: true },
      { name: "personal_email", label: "Personal email", type: "email", required: true },
      { name: "company_email", label: "Company email", type: "email", placeholder: "your-name@cebutele-net.com", pattern: "[^\\s@]+@cebutele-net\\.com", title: "Use your company email ending in @cebutele-net.com.", required: true },
      { name: "site", label: "Work site", required: true, options: [{ value: "ALABANG", label: "ALABANG" }, { value: "AYALA", label: "AYALA" }, { value: "FAUSTINA", label: "FAUSTINA" }, { value: "USA", label: "USA" }] },
    ],
  },
  {
    title: "Your work details",
    subtitle: "Complete your current work information. Fields marked * are required; Leadership start date is required for Junior Lead.",
    icon: "03",
    fields: [
      { name: "hire_date", label: "Hire date", type: "date", required: true },
      { name: "position_id", label: "Position", required: true },
      { name: "Department", label: "Department", required: true },
      { name: "levels", label: "Level", options: [{ value: "EXECUTIVE", label: "Executive" }, { value: "CORE MANAGER", label: "Core Manager" }, { value: "SENIOR LEAD", label: "Senior Lead" }, { value: "JUNIOR LEAD", label: "Junior Lead" }, { value: "APPRENTICE", label: "Apprentice" }, { value: "SPECIAL OPERATIONS AGENT", label: "Special Operations Agent" }, { value: "AGENT", label: "Agent" }] },
      { name: "shift_type", label: "Shift type", required: true, options: [{ value: "DAY SHIFT", label: "Day shift" }, { value: "MID SHIFT", label: "Mid shift" }, { value: "NIGHT SHIFT", label: "Night shift" }] },
      { name: "shift", label: "Shift", required: true, placeholder: "9:00 PM - 6:00 AM", hint: "Use the format h:mm AM - h:mm AM.", pattern: "(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM) - (0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)", title: "Use a format such as 9:00 PM - 6:00 AM." },
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

export default function Home() {
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
    if (submitted || (!codeChecked && !pendingDraft.current) || (codeChecked && !values.employee_code)) {
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
  }, [draftReady, codeChecked, submitted, values, existingProfile, activeStep, employeeCode]);

  const step = steps[activeStep];
  const progress = ((activeStep + 1) / steps.length) * 100;
  const previewSections = [
    { title: steps[0].title, index: 0, fields: steps[0].fields },
    { title: steps[1].title, index: 1, fields: [...steps[1].fields, { name: "address", label: "Home address" }, { name: "photo", label: "Profile photo" }] },
    { title: steps[2].title, index: 2, fields: [...steps[2].fields.filter((field) => field.name !== "shift"), { name: "account_lob_assignments", label: "Accounts and LOBs" }, ...(values.hire_date_leader ? [{ name: "hire_date_leader", label: "Leadership start date" }] : []), steps[2].fields.find((field) => field.name === "shift")!] },
    { title: steps[3].title, index: 3, fields: steps[3].fields },
  ];

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
      setValues(draftToRestore ? { ...loadedValues, ...draftToRestore.values } : loadedValues);
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
      setActiveStep(draftToRestore?.activeStep ?? 0);
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
    if (name === "account_lob_assignments") {
      try {
        const assignments = JSON.parse(values.account_lob_assignments || "[]") as { account_id: string; lob_ids: string[] }[];
        const labels = assignments.flatMap((assignment) => {
          const account = accountOptions.find((option) => option.value === assignment.account_id)?.label ?? assignment.account_id;
          const lobs = (lobsByAccount[assignment.account_id] ?? []).filter((option) => assignment.lob_ids.includes(option.value)).map((option) => option.label);
          return [lobs.length ? `${account}: ${lobs.join(", ")}` : account];
        });
        return labels.join("; ") || "Not provided";
      } catch { return "Not provided"; }
    }
    const value = values[name];
    if (!value) return "Not provided";
    if (name === "position_id") return positionOptions.find((option) => option.value === value)?.label ?? (savedOptions[name]?.value === value ? savedOptions[name].label : value);
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
      const next = { ...current, [name]: emailFields.includes(name) || name === "vici_link" || name === "account_lob_assignments" ? value : value.toUpperCase() };
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
      setSubmitted(true);
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
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>CTNP <b>People</b></span>
        </a>
        <div className="topbar-right"><span className="secure-dot" /> Employee records <span className="topbar-divider">·</span> New profile</div>
      </header>

      <section className="page-content" id="home">
        <div className="intro">
          <div className="eyebrow"><span /> PEOPLE OPERATIONS</div>
          <h1>Employee information</h1>
          <p>{submitted ? "Submitted. Thank you!" : codeChecked ? "Please complete each section with your information. You can go back to review your answers." : "Enter your Employee Code to check for a saved profile before you begin."}</p>
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
          ) : submitted ? (
            <div className="notice employee-save-success" role="status">
              <span aria-hidden="true">✓</span>
              <div><strong>Submitted</strong><p>Thank you!</p></div>
            </div>
          ) : (<>
          <div className="progress-area">
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
          </div>

          <form aria-busy={saving} onSubmit={(event) => { event.preventDefault(); if (activeStep < steps.length - 1) { setActiveStep(activeStep + 1); setSubmitted(false); setSubmissionError(""); } else { void finish(); } }}>
            <div className="form-heading">
              <div className="heading-icon">{step.icon}</div>
              <div><h2>{step.title}</h2><p>{step.subtitle}</p></div>
            </div>
            <div className="employee-code-context">
              <div><strong>{values.employee_code}</strong><span>{existingProfile ? "Saved profile loaded. Review and update your information." : "No saved profile found. Complete your information below."}</span></div>
              <button type="button" disabled={saving} onClick={() => { setEmployeeCode(values.employee_code || ""); setLookupError(""); setShowLookupModal(false); setCodeChecked(false); }}>Change Employee Code</button>
            </div>

            {activeStep === steps.length - 1 ? (
              <div className="employee-preview-content">
                <section className="employee-preview-hero" aria-label="Employee profile preview">
                  <div className="employee-preview-avatar">{photoPreview ? <img src={photoPreview} alt="Employee profile" /> : (values.first_name?.[0] ?? "E") + (values.last_name?.[0] ?? "")}</div>
                  <div className="employee-preview-identity">
                    <span className="employee-preview-kicker">EMPLOYEE PROFILE PREVIEW</span>
                    <h3>{values.employee_name || "YOUR NAME WILL APPEAR HERE"}</h3>
                    <p>{previewValue("position_id")}<span aria-hidden="true"> · </span>{previewValue("Department")}</p>
                  </div>
                  <span className="employee-preview-employeeId"><small>EMPLOYEE CODE</small>{previewValue("employee_code")}</span>
                </section>
                {previewSections.map((section) => (
                  <section className="employee-preview-section" key={section.title}>
                    <div className="employee-preview-sectionHeading"><h3>{section.title}</h3><button type="button" disabled={saving || submitted} onClick={() => goToStep(section.index)}>Edit</button></div>
                    <dl className="employee-preview-grid">
                      {section.fields.filter((field) => field.name !== "employee_name" && field.name !== "photo").map((field) => (
                        <div className="employee-preview-item" key={field.name}>
                          <dt>{field.label}</dt>
                          <dd>{field.name === "address" ? (values.address || "Not provided") : previewValue(field.name)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
                {!submitted && <div className="review-panel">
                  <div className="review-icon">✓</div>
                  <div><strong>Review complete?</strong><p>Check your details above, then select Submit. You can edit any section before continuing.</p></div>
                </div>}
              </div>
            ) : (
            <div className="fields-grid">
              {activeStep === 2 && <section className="field-wide assignment-section" aria-labelledby="assignments-heading">
                <div className="assignment-heading"><div className="assignment-title-row"><span className="field-label" id="assignments-heading">Accounts and LOBs</span><span className="optional-text">Optional</span></div><span className="field-hint">Choose one or more accounts, then select the LOBs for each one.</span></div>
                <div className="account-list">{accountOptions.map((account) => {
                  let assignments: { account_id: string; lob_ids: string[] }[] = [];
                  try { assignments = JSON.parse(values.account_lob_assignments || "[]"); } catch {}
                  const selected = assignments.find((assignment) => assignment.account_id === account.value);
                  const accountLobs = lobsByAccount[account.value] ?? [];
                  const setAssignments = (lobIds: string[]) => {
                    const next = assignments.filter((assignment) => assignment.account_id !== account.value);
                    if (selected || lobIds.length) next.push({ account_id: account.value, lob_ids: lobIds });
                    update("account_lob_assignments", JSON.stringify(next));
                  };
                  return <section className={`account-card${selected ? " account-card-selected" : ""}`} key={account.value}>
                    <label className="check-row account-check"><input type="checkbox" checked={Boolean(selected)} onChange={(event) => {
                      if (event.target.checked) update("account_lob_assignments", JSON.stringify([...assignments, { account_id: account.value, lob_ids: [] }]));
                      else update("account_lob_assignments", JSON.stringify(assignments.filter((assignment) => assignment.account_id !== account.value)));
                    }} /><span>{account.label}</span></label>
                    {selected && <div className="lob-list" aria-label={`${account.label} LOB options`}>
                      {accountLobs.length > 1 && <label className="check-row select-all-lobs"><input type="checkbox" checked={accountLobs.every((lob) => selected.lob_ids.includes(lob.value))} onChange={(event) => setAssignments(event.target.checked ? accountLobs.map((lob) => lob.value) : [])} /><span>Select all LOBs</span></label>}
                      {accountLobs.map((lob) => <label className="check-row" key={lob.value}><input type="checkbox" checked={selected.lob_ids.includes(lob.value)} onChange={(event) => setAssignments(event.target.checked ? [...new Set([...selected.lob_ids, lob.value])] : selected.lob_ids.filter((id) => id !== lob.value))} /><span>{lob.label}</span></label>)}
                      {accountLobs.length === 0 && <span className="field-hint">No LOBs are currently available for this account.</span>}
                    </div>}
                  </section>;
                })}</div>
              </section>}
              {step.fields.flatMap((field) => {
                let configuredField: Field = field.name === "position_id"
                  ? { ...field, options: positionOptions }
                  : field;
                const savedOption = savedOptions[field.name];
                if (configuredField.options && savedOption && savedOption.value === values[field.name]
                  && !configuredField.options.some((option) => option.value === savedOption.value)
                  && (field.name !== "lob_id" || savedOptions.account_id?.value === values.account_id)) {
                  configuredField = { ...configuredField, options: [...configuredField.options, savedOption] };
                }
                const fieldInput = <FieldInput key={field.name} field={configuredField} value={values[field.name] ?? ""} onChange={(value) => update(field.name, value)} uppercase={field.type !== "url" && !(activeStep === 1 && ["employee_email", "personal_email", "company_email"].includes(field.name))} />;
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
            <div className="form-footer">
              <span className="save-note"><span className="save-icon">▣</span> Draft saved in this browser</span>
              <div className="actions">
                {activeStep > 0 && !submitted && <button type="button" className="back-button" disabled={saving} onClick={() => goToStep(activeStep - 1)}>← <span>Back</span></button>}
                <button className="next-button" type="submit" disabled={saving || submitted}>{submitted ? "Saved" : saving ? "Saving…" : activeStep === steps.length - 1 ? existingProfile ? "Save changes" : "Submit" : "Continue"}{!saving && !submitted && <span>→</span>}</button>
              </div>
            </div>
          </form>
          </>)}
        </section>
        <footer className="page-footer"><span>CTNP SYSTEM</span><span>EMPLOYEE PROFILE</span></footer>
      </section>
      {showLookupModal && createPortal((
        <div className="modal-backdrop lookup-modal-backdrop">
          <section className="lookup-modal" role="dialog" aria-modal="true" aria-labelledby="lookup-modal-title" aria-describedby="lookup-modal-description">
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
                <span>{assignment.lob_options?.map((lob) => lob.label).join(", ") || assignment.lob_ids.join(", ")}</span>
              </li>)}
            </ul>}
            <button type="button" className="next-button lookup-modal-action" autoFocus onClick={continueAfterLookup}>
              {existingProfile ? detectedAssignments.length ? "Load saved profile" : "Continue and add account" : "Create new profile"}<span aria-hidden="true">→</span>
            </button>
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
