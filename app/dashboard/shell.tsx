"use client";

import "./dashboard.css";
import { useDashboardGuard } from "./guard";
import LogoutButton from "./logout-button";

type DashboardShellProps = {
  role: string;
  title: string;
  blurb: string;
  features: string[];
};

/**
 * Shared client-side dashboard shell. Renders the role's content only after
 * the server confirms the signed-in employee actually holds that role.
 */
export default function DashboardShell({ role, title, blurb, features }: DashboardShellProps) {
  const state = useDashboardGuard(role);
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
  const initials = state.result.name
    .split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("") || "CT";
  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <header className="dashboard-hero">
          <span className="dashboard-avatar" aria-hidden="true">{initials}</span>
          <div className="dashboard-hero-text">
            <p className="dashboard-kicker">{role.toUpperCase()} DASHBOARD</p>
            <h1>{title}</h1>
            <p className="dashboard-blurb">{blurb}</p>
          </div>
          <LogoutButton />
        </header>
        {state.result.name && (
          <p className="dashboard-identity">
            Signed in as <strong>{state.result.name}</strong>
            {state.result.position ? <> · {state.result.position}</> : null}
          </p>
        )}
        <ul className="dashboard-features">
          {features.map((feature) => (
            <li key={feature}>
              <span className="dashboard-check" aria-hidden="true">✓</span>{feature}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
