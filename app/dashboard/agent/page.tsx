"use client";

import { useRef, useState } from "react";
import { useDashboardGuard } from "../guard";
import LogoutButton from "../logout-button";
import "../dashboard.css";

type AttendanceEntry = {
  date: string;
  status: string;
  inTime: string;
  outTime: string;
};

type IncidentDraft = {
  type: string;
  date: string;
  details: string;
};

const incidentDraftKey = "ctnp-incident-draft-v1";

const incidentTypes = ["LATE", "ABSENT", "MISCONDUCT ESCALATION", "CLIENT COMPLAINT", "SYSTEM ISSUE", "OTHER"];

const attendanceSampleColumns = ["Date", "Status", "Time in", "Time out"] as const;

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * TEMPORARY persistence: the attendance source system and the incident
 * report table do not exist yet, so reports are kept as local drafts and
 * attendance shows an honest empty state until HR data is connected.
 */
function loadDraft(): IncidentDraft | null {
  try {
    const saved = localStorage.getItem(incidentDraftKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<IncidentDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      type: typeof parsed.type === "string" && incidentTypes.includes(parsed.type) ? parsed.type : incidentTypes[0],
      date: typeof parsed.date === "string" ? parsed.date : "",
      details: typeof parsed.details === "string" ? parsed.details.slice(0, 2000) : "",
    };
  } catch { return null; }
}

export default function AgentDashboard() {
  const state = useDashboardGuard("agent");
  // Attendance is not connected to any source system yet; wire this up
  // when timekeeping data becomes available.
  const attendance: AttendanceEntry[] = [];
  const [draft, setDraft] = useState<IncidentDraft | null>(null);
  const [incidentNotice, setIncidentNotice] = useState("");
  const [incidentError, setIncidentError] = useState("");
  const formTouched = useRef(false);

  if (state.status === "checking") {
    return (
      <main className="dashboard-shell">
        <p className="dashboard-status" role="status">Checking your access…</p>
      </main>
    );
  }
  if (state.status === "unresolved") {
    return (
      <main className="dashboard-shell">
        <p className="dashboard-status" role="status">Redirecting…</p>
      </main>
    );
  }
  const initials = state.result.name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("") || "CT";

  function openIncidentForm() {
    setDraft(loadDraft() ?? { type: incidentTypes[0], date: "", details: "" });
  }

  function updateDraft(update: Partial<IncidentDraft>) {
    if (!draft) return;
    formTouched.current = true;
    setDraft({ ...draft, ...update });
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.date || !draft.details.trim()) {
      setIncidentError("Add the incident date and details before saving the draft.");
      setIncidentNotice("");
      return;
    }
    try { localStorage.setItem(incidentDraftKey, JSON.stringify(draft)); }
    catch { setIncidentError("Your browser storage is full; the draft could not be saved."); return; }
    formTouched.current = false;
    setIncidentError("");
    setIncidentNotice("Draft saved on this device. Reporting to HR is not connected yet — no data has been sent.");
  }

  return (
    <main className="dashboard-shell dashboard-agent">
      <section className="dashboard-card dashboard-wide">
        <header className="dashboard-hero">
          <span className="dashboard-avatar" aria-hidden="true">{initials}</span>
          <div className="dashboard-hero-text">
            <p className="dashboard-kicker">AGENT DASHBOARD</p>
            <h1>Your workspace</h1>
            <p className="dashboard-blurb">Personal data, attendance, and incident reporting in one place.</p>
          </div>
          <LogoutButton />
        </header>

        <section className="dashboard-section" aria-labelledby="personal-data-heading">
          <h2 id="personal-data-heading">My personal data</h2>
          <dl className="dashboard-facts">
            <div><dt>Name</dt><dd>{state.result.name || "Not provided"}</dd></div>
            <div><dt>Employee Code</dt><dd>{state.result.employeeCode || "Not provided"}</dd></div>
            <div><dt>Position</dt><dd>{state.result.position || "Not provided"}</dd></div>
          </dl>
          <p className="dashboard-note">Full profile details live in your employee record. Select your Employee Code on the registration page to review and edit it.</p>
        </section>

        <section className="dashboard-section" aria-labelledby="attendance-heading">
          <h2 id="attendance-heading">My attendances</h2>
          {attendance.length ? (
            <table className="dashboard-table">
              <thead><tr>{attendanceSampleColumns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
              <tbody>{attendance.map((entry) => (
                <tr key={entry.date}>
                  <td>{formatDateLabel(entry.date)}</td>
                  <td>{entry.status}</td>
                  <td>{entry.inTime || "—"}</td>
                  <td>{entry.outTime || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : (
            <div className="dashboard-empty">
              <p><strong>No attendance records yet.</strong></p>
              <p>Attendance tracking is not connected to this system yet. Once your timekeeping data is linked, your records will appear here automatically.</p>
            </div>
          )}
        </section>

        <section className="dashboard-section" aria-labelledby="incident-heading">
          <h2 id="incident-heading">Incident report</h2>
          {draft ? (
            <form className="dashboard-form" onSubmit={(event) => event.preventDefault()} noValidate>
              {incidentNotice && <div className="dashboard-banner" role="status">{incidentNotice}</div>}
              {incidentError && <div className="dashboard-banner dashboard-banner-error" role="alert">{incidentError}</div>}
              <label className="dashboard-field">
                <span>Incident type</span>
                <select value={draft.type} onChange={(event) => updateDraft({ type: event.target.value })}>
                  {incidentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="dashboard-field">
                <span>Date</span>
                <input type="date" value={draft.date} onChange={(event) => updateDraft({ date: event.target.value })} />
              </label>
              <label className="dashboard-field">
                <span>Details</span>
                <textarea rows={4} value={draft.details} placeholder="Describe the incident, including people involved and what happened." onChange={(event) => updateDraft({ details: event.target.value })} />
              </label>
              <div className="dashboard-actions">
                <button type="button" className="dashboard-button" onClick={saveDraft}>Save draft</button>
                <button type="button" className="dashboard-button dashboard-button-quiet" onClick={() => { formTouched.current = false; setDraft(null); setIncidentError(""); setIncidentNotice(""); }}>Close</button>
              </div>
            </form>
          ) : (
            <div className="dashboard-report-entry">
              <p>Report an attendance incident, issue, or escalation for HR to review.</p>
              <p className="dashboard-note">Incident reports are saved as a draft on this device until reporting is connected to HR systems.</p>
              <button type="button" className="dashboard-button" onClick={openIncidentForm}>
                {loadDraft() ? "Continue draft" : "Open incident report"}
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
