"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import "./login.css";
import { createSupabaseBrowserClient, isSupabaseAuthConfigured } from "@/lib/supabase/client";
import { temporaryPasswordFor } from "@/lib/credentials";

const systemName = "CTNP People";
const heroWords = ["Lead.", "Improve.", "Deliver."];
const heroFeatures = [
  "Employee profiles and records",
  "Accounts and LOB assignments",
  "Positions, levels and work details",
];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

type AuthApiError = { code?: string; status?: number; message?: string };

function validateFields(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!emailPattern.test(email.trim())) errors.email = "Enter a valid email address, like name@company.com.";
  if (!password) errors.password = "Enter your Employee Code.";
  return errors;
}

/**
 * TEMPORARY credential scheme: the password field holds the Employee Code.
 * The server resolves the employee's canonical login email (first email on
 * file, or a synthetic one when none is on file), guarantees a matching
 * auth account exists, and returns that canonical email; only after that
 * does the standard Supabase password sign-in run with the derived
 * password (lib/credentials.ts).
 */
async function prepareTemporarySignIn(email: string, code: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: code }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || "Your sign-in could not be completed right now. Please try again.");
  }
  return typeof result?.email === "string" && result.email.trim() ? result.email.trim() : email.trim();
}

/**
 * Maps Supabase Auth failures to helpful copy without exposing sensitive
 * account details. Brute-force limits stay on the provider's server side;
 * nothing here pretends to be a security control.
 */
function describeSignInError(error: AuthApiError | undefined) {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "email_not_confirmed" || message.includes("email_not_confirmed")) {
    return "This email address has not been confirmed yet. Contact your administrator for help accessing your account.";
  }
  if (code === "invalid_credentials" || message.includes("Invalid login credentials")) {
    return "The email address or password is incorrect.";
  }
  if (code === "over_request_rate_limit" || error?.status === 429 || message.includes("over_request_rate_limit")) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  return "Your sign-in could not be completed right now. Please try again.";
}

function readyForSupabaseAuth() {
  if (!isSupabaseAuthConfigured()) {
    return "Sign-in is not configured for this environment. Please contact your administrator.";
  }
  return "";
}

/**
 * Asks the server which dashboard the signed-in employee belongs to.
 * Falls back to the generic dashboard when the role lookup fails, so a
 * temporarily unreachable API never locks an authenticated user out.
 */
async function resolveLandingPage(accessToken: string | undefined) {
  if (!accessToken) return "/dashboard";
  try {
    const response = await fetch("/api/auth/role", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return "/dashboard";
    const result = await response.json();
    if (typeof result.dashboard === "string" && result.dashboard.startsWith("/")) return result.dashboard;
  } catch {
    // Keep the fallback below.
  }
  return "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const busy = useRef(false);

  // Skip the page for users who still hold a valid session.
  useEffect(() => {
    if (!isSupabaseAuthConfigured()) return;
    void createSupabaseBrowserClient()
      .auth.getSession()
        .then(async ({ data }) => {
        if (data.session) router.replace(await resolveLandingPage(data.session.access_token));
      })
      .catch(() => {
        // A stored but unreadable session just requires a normal sign-in.
      })
      .finally(() => setCheckingSession(false));
  }, [router]);

  // Honor reduced motion everywhere, and stop the headline rotation for it.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => setHeroWordIndex((index) => (index + 1) % heroWords.length), 3_000);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  function clearFlaggedError() {
    if (formError) setFormError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || signedIn) return;
    const notConfigured = readyForSupabaseAuth();
    const errors = validateFields(email, password);
    setFieldErrors(errors);
    setFormError(notConfigured);
    if (Object.keys(errors).length > 0 || notConfigured) return;

    busy.current = true;
    setSubmitting(true);
    try {
      const canonicalEmail = await prepareTemporarySignIn(email.trim(), password);
      const { data, error } = await createSupabaseBrowserClient(remember).auth.signInWithPassword({
        email: canonicalEmail,
        password: temporaryPasswordFor(password),
      });
      if (error) {
        setFormError(describeSignInError(error));
        return;
      }
      if (!data.session) {
        setFormError("Your sign-in could not be completed. Please try again.");
        return;
      }
      setSignedIn(true);
      setFormError("");
      router.replace(await resolveLandingPage(data.session.access_token));
    } catch (error) {
      // Surface the server's message (e.g. wrong code) instead of masking it
      // as a connectivity failure; only genuine network failures are generic.
      setFormError(error instanceof TypeError
        ? "Unable to connect. Please try again."
        : error instanceof Error && error.message
          ? error.message
          : "Unable to connect. Please try again.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  const submitDisabled = submitting || signedIn || (isSupabaseAuthConfigured() && checkingSession);
  const heroWord = heroWords[heroWordIndex];

  return (
    <main className="login-page">
      <section className="login-hero" aria-label={`Welcome to ${systemName}`}>
        <img className="login-hero-image" src="/ctnp-bg-image-1.png" alt="" />
        <div className="login-hero-shade" aria-hidden="true" />
        <span className="login-hero-ring login-hero-ring-a" aria-hidden="true" />
        <span className="login-hero-ring login-hero-ring-b" aria-hidden="true" />
        <span className="login-hero-ring login-hero-ring-c" aria-hidden="true" />
        <div className="login-hero-content">
          <div className="login-hero-brand">
            <img className="login-hero-logo" src="/ctnp-logo.png" alt="" />
            <span>CTNP <b>People</b></span>
          </div>
          <div className="login-hero-message">
            <p className="login-hero-headline" aria-label="Train. Track. Lead, Improve, Deliver.">
              Train. Track.{" "}
              <span key={heroWord} className="login-hero-rotated" aria-hidden="true">{heroWord}</span>
            </p>
            <p className="login-hero-support">Manage employee records in one place.</p>
            <ul className="login-hero-features">
              {heroFeatures.map((feature) => (
                <li key={feature}><span className="login-hero-check" aria-hidden="true">✓</span>{feature}</li>
              ))}
            </ul>
          </div>
          <p className="login-hero-foot">Employee work details are protected. Sign in from your trusted device.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-mobile-brand">
          <img src="/ctnp-logo.png" alt="" />
          <strong>{systemName}</strong>
          <span>Manage employee records in one place.</span>
        </div>

        <div className="login-card">
          <h1 id="login-heading" className="login-heading">Welcome back</h1>
          <p className="login-support">Sign in to your {systemName} account.</p>

          <form className="login-form" noValidate aria-busy={submitting} onSubmit={handleSubmit}>
            {formError && (
              <div className="login-alert" role="alert">
                <span className="login-alert-mark" aria-hidden="true">!</span>
                <p>{formError}</p>
              </div>
            )}
            {signedIn && (
              <div className="login-success" role="status">
                <span className="login-alert-mark" aria-hidden="true">✓</span>
                <p>Signed in successfully. Taking you to {systemName}…</p>
              </div>
            )}

            <label className="login-field" htmlFor="login-email">
              <span className="login-label">Email</span>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                value={email}
                placeholder="you@company.com"
                disabled={submitting || signedIn}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                onChange={(event) => { setEmail(event.target.value); clearFlaggedError(); }}
              />
              {fieldErrors.email && <span id="login-email-error" className="login-field-error" role="alert">{fieldErrors.email}</span>}
            </label>

            <label className="login-field" htmlFor="login-password">
              <span className="login-label">Password</span>
              <span className="login-password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="off"
                  value={password}
                  placeholder="Your Employee Code"
                  disabled={submitting || signedIn}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  onChange={(event) => { setPassword(event.target.value); clearFlaggedError(); }}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeSlashIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
                </button>
              </span>
              {fieldErrors.password && <span id="login-password-error" className="login-field-error" role="alert">{fieldErrors.password}</span>}
              <span className="login-field-hint">Temporary logins: enter the email on file for your record and your Employee Code as the password.</span>
            </label>

            <div className="login-row">
              <label className="login-remember" htmlFor="login-remember">
                <input
                  id="login-remember"
                  name="remember"
                  type="checkbox"
                  checked={remember}
                  disabled={submitting || signedIn}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <div className="login-help">
                <button
                  type="button"
                  className="login-help-toggle"
                  aria-expanded={helpOpen}
                  aria-controls="login-help-panel"
                  onClick={() => setHelpOpen((open) => !open)}
                >
                  Need help?
                </button>
                {helpOpen && (
                  <div id="login-help-panel" className="login-help-panel" role="note">
                    <strong>Can’t sign in?</strong>
                    <p>Contact your {systemName} administrator to check access to your account. Password resets are handled by your administrator.</p>
                  </div>
                )}
              </div>
            </div>

            <button type="submit" className="login-button" disabled={submitDisabled}>
              {submitDisabled ? (
                <span className="login-button-label">
                  {submitting && !signedIn && <span className="login-spinner" aria-hidden="true" />}
                  {signedIn ? "Signed in · Redirecting…" : submitting ? "Signing in…" : "Checking sign-in status…"}
                </span>
              ) : "Sign In"}
            </button>
          </form>

          <div className="login-alt" aria-label="New employee registration">
            <span>New employee?</span>
            <Link href="/register" className="login-alt-button" prefetch={false}>Register</Link>
          </div>
        </div>

        <p className="login-footer"><strong>{systemName}</strong><span aria-hidden="true">|</span>Authorized employees only</p>
      </section>
    </main>
  );
}
