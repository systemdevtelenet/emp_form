import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Add an Employee | CTNP People",
  description: "Create an employee profile for CTNP System.",
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
