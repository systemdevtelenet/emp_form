"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient, isSupabaseAuthConfigured } from "@/lib/supabase/client";

/**
 * Bare /dashboard path: forward to whatever the server resolves for the
 * signed-in employee's role, mirroring the sign-in redirect decision.
 */
export default function DashboardIndexPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      if (!isSupabaseAuthConfigured()) {
        router.replace("/");
        return;
      }
      try {
        const { data } = await createSupabaseBrowserClient().auth.getSession();
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
        if (!active) return;
        router.replace(result.resolved ? result.dashboard : (result.dashboard || "/register"));
      } catch {
        if (active) router.replace("/");
      }
    };
    void resolve();
    return () => { active = false; };
  }, [router]);

  return (
    <main className="dashboard-shell">
      <p className="dashboard-status" role="status">Resolving your dashboard…</p>
    </main>
  );
}
