"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient, isSupabaseAuthConfigured } from "@/lib/supabase/client";

/**
 * Ends the active session wherever it lives (localStorage or in-memory)
 * and returns employees to the sign-in page.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [label, setLabel] = useState("Log out");
  const busy = useRef(false);

  async function handleLogout() {
    if (busy.current) return;
    busy.current = true;
    setLabel("Logging out…");
    try {
      if (isSupabaseAuthConfigured()) {
        await createSupabaseBrowserClient().auth.signOut();
      }
      router.replace("/");
    } catch {
      // A failed local sign-out still sends the user to the sign-in page;
      // the login page refreshes the stale session and recovers there.
      router.replace("/");
    }
  }

  return (
    <button type="button" className="dashboard-logout" onClick={() => void handleLogout()}>
      {label}
    </button>
  );
}
