import type { FundData, FundComparison } from "@/shared/finance-types";
import { useQuery } from "@tanstack/react-query";
import { requireUserId, rowNum, rowStr, untypedDb, uiToDbAccountType, type DbRow } from "./common";

export function useFundComparisons() {
  return useQuery({
    queryKey: ["fund-comparisons"],
    queryFn: async (): Promise<FundComparison[]> => {
      const userId = await requireUserId();
      const db = untypedDb();
      const { data: accounts } = await db
        .from("accounts")
        .select("id, institution")
        .eq("user_id", userId)
        .eq("type", uiToDbAccountType.INVESTMENT);

      if (!accounts?.length) return [];

      const { data: positions, error } = await db
        .from("investment_positions")
        .select("*")
        .eq("user_id", userId);

      if (error || !positions?.length) return [];

      const accountById = new Map(
        (accounts as DbRow[]).map((a) => [rowStr(a, "id"), rowStr(a, "institution", "—")]),
      );
      const funds: FundData[] = (positions as DbRow[]).map((p) => ({
        name: rowStr(p, "fund_name", "Desconhecido"),
        code: rowStr(p, "fund_code"),
        type: classifyFund(rowStr(p, "fund_name")),
        institution: accountById.get(rowStr(p, "account_id")) ?? "—",
        dailyReturn: rowNum(p, "daily_return"),
        annualReturn: rowNum(p, "annual_return"),
        minInvest: 0,
        liquidity: "D+0",
        rating: Math.round(rowNum(p, "annual_return") * 10),
      }));

      funds.sort((a, b) => b.annualReturn - a.annualReturn);
      const maxReturn = Math.max(...funds.map((f) => f.annualReturn), 1);
      return funds.map((fund, i) => ({
        fund,
        rank: i + 1,
        percentile: (fund.annualReturn / maxReturn) * 100,
      }));
    },
  });
}

function classifyFund(name: string): FundData["type"] {
  const n = name.toLowerCase();
  if (n.includes("di") || n.includes("referenciado")) return "DI";
  if (n.includes("cdb") || n.includes("tesouro") || n.includes("prefixado")) return "Renda Fixa";
  if (n.includes("multimercado") || n.includes("macro") || n.includes("livre")) return "Multimercado";
  if (n.includes("aça") || n.includes("ações") || n.includes("equity")) return "Ações";
  if (n.includes("cripto") || n.includes("bitcoin") || n.includes("btc")) return "Cripto";
  return "Renda Fixa";
}
