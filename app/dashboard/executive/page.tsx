import DashboardShell from "../shell";

export default function ExecutiveDashboardPage() {
  return <DashboardShell
    role="executive"
    title="Executive workspace"
    blurb="Company-wide operational and workforce insights."
    features={["Workforce summary", "Cross-account performance", "Organizational structure"]}
  />;
}
