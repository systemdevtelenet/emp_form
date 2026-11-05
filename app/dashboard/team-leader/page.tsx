import DashboardShell from "../shell";

export default function TeamLeaderDashboardPage() {
  return <DashboardShell
    role="team-leader"
    title="Team leader workspace"
    blurb="Track your team's agents, performance, and schedules."
    features={["Your team roster", "Agent performance overview", "Shift and account coverage"]}
  />;
}
