import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/format";

type CashflowPoint = { month: string; receitas: number; despesas: number };

/** Presentation only: receives the same monthly series as the accompanying table. */
export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  return (
    <div
      className="h-80 min-w-0 w-full"
      role="img"
      aria-label="Receitas e despesas por mês. Valores completos disponíveis na tabela de fluxo de caixa."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          accessibilityLayer
          margin={{ top: 16, right: 8, left: 0, bottom: 8 }}
          barGap={6}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} minTickGap={24} />
          <YAxis
            tickFormatter={(value: number) => formatBRL(value, true)}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={72}
          />
          <Tooltip
            formatter={(value: number) => formatBRL(value)}
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            contentStyle={{
              background: "var(--popover)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              fontSize: 13,
            }}
            itemStyle={{ color: "var(--foreground)" }}
          />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: 16, fontSize: 13 }} />
          <Bar
            name="Receitas"
            dataKey="receitas"
            fill="var(--chart-2)"
            radius={[8, 8, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
          <Bar
            name="Despesas"
            dataKey="despesas"
            fill="var(--chart-3)"
            radius={[8, 8, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
