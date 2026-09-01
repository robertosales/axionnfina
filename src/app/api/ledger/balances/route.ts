import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ledgerService } from "@/modules/transactions/ledger";

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
    const asOfDate = url.searchParams.get("as_of_date")
      ? new Date(url.searchParams.get("as_of_date")!)
      : new Date();

    const balances = await ledgerService.getLedgerBalances(asOfDate);

    return NextResponse.json(balances);
  } catch (error) {
    console.error("Ledger balances error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
