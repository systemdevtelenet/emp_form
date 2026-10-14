import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("positions")
      .select("position_id, position_name")
      .not("position_name", "is", null)
      .order("position_name");

    if (error) {
      console.error("Position options fetch failed", { code: error.code || "UNKNOWN" });
      return Response.json({ error: "Position options are temporarily unavailable." }, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const options = (data ?? []).map((position) => ({
      value: String(position.position_id),
      label: position.position_name!.trim(),
    }));
    return Response.json({ options }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Position options configuration error", error instanceof Error ? error.message : "UNKNOWN");
    return Response.json({ error: "Position options are temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
