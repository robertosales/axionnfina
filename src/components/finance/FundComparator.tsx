import type { FundComparison } from "@/shared/finance-types";
import { TrendingUp, ArrowUp, ArrowDown, Minus } from "lucide-react";

export function FundComparator({ data }: { data: FundComparison[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-elevation-1">
        <p className="text-sm text-muted-foreground">Nenhum fundo de investimento encontrado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Comparador de Fundos</h3>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40">
              <th className="pb-2 text-left font-medium">Rank</th>
              <th className="pb-2 text-left font-medium">Fundo</th>
              <th className="pb-2 text-left font-medium">Tipo</th>
              <th className="pb-2 text-right font-medium">Rent. Anual</th>
              <th className="pb-2 text-right font-medium">Ranking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {data.map((item) => (
              <tr key={item.fund.code} className="hover:bg-muted/30">
                <td className="py-2">
                  <span className="font-semibold">#{item.rank}</span>
                </td>
                <td className="py-2">
                  <p className="font-medium">{item.fund.name}</p>
                  <p className="text-muted-foreground text-[10px]">{item.fund.institution}</p>
                </td>
                <td className="py-2">
                  <span className="capitalize">{item.fund.type}</span>
                </td>
                <td className="numeric py-2 text-right font-semibold text-income">
                  {item.fund.annualReturn.toFixed(2)}%
                </td>
                <td className="py-2 text-right">
                  {item.percentile >= 80 ? (
                    <ArrowUp className="inline size-4 text-income" />
                  ) : item.percentile < 20 ? (
                    <ArrowDown className="inline size-4 text-expense" />
                  ) : (
                    <Minus className="inline size-4 text-muted-foreground" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
