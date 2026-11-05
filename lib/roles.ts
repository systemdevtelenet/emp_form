/**
 * Maps an employee's position (with level as a secondary signal) to the
 * dashboard role they land in after signing in. The mapping lives in code
 * while the position list is small and HR-controlled; revisit if mappings
 * need to change without a deploy.
 */

export const dashboardRoles = ["agent", "team-leader", "manager", "executive", "admin"] as const;

export type DashboardRole = (typeof dashboardRoles)[number];

export type RoleResolution = {
  role: DashboardRole;
  dashboard: string;
  position: string;
};

const roleByKeyword: [RegExp, DashboardRole][] = [
  [/SPECIAL OPERATIONS|APPRENTICE|\bL1\b|\bL2\b|\bL3\b/, "agent"],
  [/AGENT/, "agent"],
  [/JUNIOR LEAD|SENIOR LEAD|\bLEAD\b/, "team-leader"],
  [/EXECUTIVE|PRESIDENT|DIRECTOR|\bHEAD\b|CHIEF|\bCEO\b|\bCOO\b|\bCFO\b/, "executive"],
  [/IT MANAGER|IT ACCOUNT|SYSTEMS|DEVELOPER|ADMIN|SUPPORT ENGINEER|DEVOPS/, "admin"],
  [/MANAGER/, "manager"],
];

const dashboardByRole: Record<DashboardRole, string> = {
  agent: "/dashboard/agent",
  "team-leader": "/dashboard/team-leader",
  manager: "/dashboard/manager",
  executive: "/dashboard/executive",
  admin: "/dashboard/admin",
};

export const defaultRole: DashboardRole = "agent";

/**
 * The `levels` field disambiguates role keywords that can collide with a
 * position name (for example, a position containing "Lead" still maps to
 * an agent dashboard when the employee's level is Agent or L1–L3).
 */
export function resolveDashboardRole(...signals: (string | null | undefined)[]): RoleResolution {
  const position = signals.map((signal) => (signal ?? "").trim().toUpperCase()).filter(Boolean).join(" ");
  const level = (signals.findLast((signal) => signal && !signal.includes(":")) ?? "").trim().toUpperCase();
  const haystack = `${position} ${level}`;
  for (const [pattern, role] of roleByKeyword) {
    if (pattern.test(haystack)) {
      return { role, dashboard: dashboardByRole[role], position };
    }
  }
  return { role: defaultRole, dashboard: dashboardByRole[defaultRole], position };
}

export function dashboardPathFor(role: string): string {
  return dashboardByRole[role as DashboardRole] ?? dashboardByRole[defaultRole];
}
