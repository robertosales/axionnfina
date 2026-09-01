import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const startDate =
      url.searchParams.get("start_date") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const endDate = url.searchParams.get("end_date") || new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("get_transactions_summary", {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Transaction summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
