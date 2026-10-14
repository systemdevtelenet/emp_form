import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("lobs")
      .select("lob_id, account_id, lob_name")
      .not("lob_name", "is", null)
      .order("lob_name");

    if (error) {
      console.error("LOB options fetch failed", { code: error.code || "UNKNOWN" });
      return Response.json({ error: "LOB options are temporarily unavailable." }, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const options: Record<string, { value: string; label: string }[]> = {};
    for (const lob of data ?? []) {
      const label = lob.lob_name?.trim();
      if (!label) continue;
      const accountId = String(lob.account_id);
      (options[accountId] ??= []).push({ value: String(lob.lob_id), label });
    }
    return Response.json({ options }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("LOB options configuration error", error instanceof Error ? error.message : "UNKNOWN");
    return Response.json({ error: "LOB options are temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
