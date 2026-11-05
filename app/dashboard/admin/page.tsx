import DashboardShell from "../shell";

export default function AdminDashboardPage() {
  return <DashboardShell
    role="admin"
    title="IT & admin workspace"
    blurb="Systems, accounts, and employee record administration."
    features={["Employee record administration", "Account and access provisioning", "System status"]}
  />;
}
