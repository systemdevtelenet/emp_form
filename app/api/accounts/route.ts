import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("account_id, account_name")
      .eq("is_active", true)
      .not("account_name", "is", null)
      .order("account_name");

    if (error) {
      console.error("Account options fetch failed", { code: error.code || "UNKNOWN" });
      return Response.json({ error: "Account options are temporarily unavailable." }, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const options = (data ?? []).map((account) => ({
      value: String(account.account_id),
      label: account.account_name!.trim(),
    }));
    return Response.json({ options }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Account options configuration error", error instanceof Error ? error.message : "UNKNOWN");
    return Response.json({ error: "Account options are temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
