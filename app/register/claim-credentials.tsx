"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRightIcon, UserCircleIcon } from "@heroicons/react/24/outline";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ClaimErrors = { employeeCode?: string };

/**
 * TEMPORARY claim flow: only the Employee Code is required. The login is
 * created against the email on file and the password is the
 * Employee Code (lib/credentials.ts) — remove this whole flow once
 * self-chosen passwords ship.
 */
export default function ClaimCredentials() {
  // No visible toggle: the claim form renders only at /register?claim=1.
  const claimRequested = useSearchParams().get("claim") !== null;
  const [employeeCode, setEmployeeCode] = useState("");
  const [errors, setErrors] = useState<ClaimErrors>({});
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  function validate() {
    return /\d/.test(employeeCode) ? {} : { employeeCode: "Enter your Employee Code." };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || done) return;
    const found = validate() satisfies ClaimErrors;
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;
    busy.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: employeeCode.trim() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(result?.error || "Your account could not be created. Please try again.");
        return;
      }
      if (typeof result?.email === "string" && emailPattern.test(result.email)) setClaimEmail(result.email);
      setDone(true);
    } catch {
      setFormError("Unable to connect. Please try again.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  if (!claimRequested) {
    return (
      <div className="claim-credentials claim-credentials-invite">
        <span className="claim-credentials-invite-icon" aria-hidden="true"><UserCircleIcon /></span>
        <div className="claim-credentials-invite-copy">
          <p className="claim-credentials-invite-title">Already have an Employee Code?</p>
          <p className="claim-credentials-message">Set up your login credentials to sign in.</p>
        </div>
        <Link href="/" className="claim-credentials-login">Login <ArrowRightIcon aria-hidden="true" /></Link>
      </div>
    );
  }

  const canSubmit = submitting || done;

  return (
    <div className="claim-credentials">
      {done ? (
        <div className="claim-credentials-success" role="status">
          <p>
            Your login is ready{claimEmail ? <> for <strong>{claimEmail}</strong></> : null}.
            Head to the <Link href="/">sign-in page</Link> and use the email on file for your record with your Employee Code as the password.
          </p>
        </div>
      ) : (
        <form className="claim-credentials-form-grid" noValidate onSubmit={handleSubmit}>
          {formError && <div className="claim-credentials-error" role="alert">{formError}</div>}
          <label className="claim-credentials-field" htmlFor="claim-code">
            <span>Employee Code</span>
            <input id="claim-code" name="employeeCode" type="text" autoCapitalize="characters" value={employeeCode} disabled={canSubmit} aria-invalid={errors.employeeCode ? true : undefined} onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())} />
            {errors.employeeCode && <span className="claim-credentials-field-error" role="alert">{errors.employeeCode}</span>}
          </label>
          <button type="submit" className="claim-credentials-submit" disabled={canSubmit}>
            {submitting ? "Creating your login…" : "Create my login"}
          </button>
          <p className="claim-credentials-help">Your login uses the email on file for this Employee Code, with the code itself as a temporary password.</p>
        </form>
      )}
    </div>
  );
}
