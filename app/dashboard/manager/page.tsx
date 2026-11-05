import DashboardShell from "../shell";

export default function ManagerDashboardPage() {
  return <DashboardShell
    role="manager"
    title="Manager workspace"
    blurb="Oversee teams, accounts, and operational performance."
    features={["Team leader directory", "Account and LOB performance", "Position and staffing overview"]}
  />;
}
