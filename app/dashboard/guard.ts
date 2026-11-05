"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient, isSupabaseAuthConfigured } from "@/lib/supabase/client";

export type GuardResult = {
  name: string;
  position: string;
  employeeCode: string;
};

export type GuardState =
  | { status: "checking" }
  | { status: "ready"; result: GuardResult }
  | { status: "unresolved" };

/**
 * Client-side dashboard guard consistent with the browser-based session
 * storage used by the login page (localStorage, not cookies). The claimed
 * role is never trusted from the browser: the server verifies the session
 * token and derives the role from the employee's own database record.
 */
export function useDashboardGuard(role: string): GuardState {
  const router = useRouter();
  const [state, setState] = useState<GuardState>({ status: "checking" });
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (!isSupabaseAuthConfigured()) {
      router.replace("/login");
      return;
    }
    const client = createSupabaseBrowserClient();
    client.auth.getSession()
      .then(async ({ data }) => {
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          router.replace("/");
          return;
        }
        const response = await fetch("/api/auth/role", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result) {
          router.replace("/");
          return;
        }
        if (!result.resolved) {
          router.replace(result.dashboard || "/register");
          return;
        }
        if (result.role !== role) {
          redirected.current = true;
          router.replace(result.dashboard);
          return;
        }
        setState({
          status: "ready",
          result: {
            name: result.name ?? "",
            position: result.position ?? "",
            employeeCode: result.employeeCode ?? "",
          },
        });
      })
      .catch(() => router.replace("/"));
  }, [role, router]);

  return state;
}
