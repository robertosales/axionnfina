import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/format";
import type { CategoryBreakdown, MonthlyFlow, WealthPoint } from "@/lib/reports";
import type { ReportDestination } from "@/hooks/use-reports";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)", "var(--transfer)"] as const;
const tooltipStyle = { background: "var(--popover)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 };

export function MonthlyFlowChart({ data }: { data: MonthlyFlow[] }) {
  return <div className="h-80 min-w-0" role="img" aria-label="Receitas, despesas e resultado mensal">
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" />
      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickFormatter={(v: number) => formatBRL(v, true)} tickLine={false} axisLine={false} width={72} fontSize={11} />
      <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle} /><Legend />
      <Bar name="Receitas" dataKey="income" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={26} />
      <Bar name="Despesas" dataKey="expenses" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={26} />
      <Line name="Resultado" dataKey="result" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3 }} />
    </ComposedChart></ResponsiveContainer>
  </div>;
}

export function SavingsRateChart({ data }: { data: MonthlyFlow[] }) {
  return <div className="h-64 min-w-0" role="img" aria-label="Histórico da taxa de poupança">
    <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 4 }}>
      <defs><linearGradient id="savings-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35}/><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0}/></linearGradient></defs>
      <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12}/><YAxis unit="%" tickLine={false} axisLine={false} fontSize={11}/>
      <Tooltip formatter={(v: number) => `${v.toFixed(1).replace(".", ",")}%`} contentStyle={tooltipStyle}/><Area name="Taxa de poupança" dataKey="savingsRate" stroke="var(--chart-1)" fill="url(#savings-fill)" strokeWidth={3}/>
    </AreaChart></ResponsiveContainer>
  </div>;
}

export function CategoryDonut({ data, onSelect }: { data: CategoryBreakdown[]; onSelect: (category: string) => void }) {
  const chart = data.slice(0, 7);
  return <div className="h-72 min-w-0" role="img" aria-label="Distribuição de despesas por categoria">
    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart} dataKey="value" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2} onClick={(entry) => onSelect(String(entry.category))} cursor="pointer">
      {chart.map((item, index) => <Cell key={item.category} fill={COLORS[index % COLORS.length]} />)}
    </Pie><Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle}/><Legend verticalAlign="bottom" iconType="circle" /></PieChart></ResponsiveContainer>
  </div>;
}

export function CategoryComparisonChart({ data }: { data: CategoryBreakdown[] }) {
  return <div className="h-80 min-w-0" role="img" aria-label="Comparação de despesas por categoria">
    <ResponsiveContainer width="100%" height="100%"><BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 20, right: 8 }}>
      <CartesianGrid stroke="var(--border)" horizontal={false} strokeDasharray="3 4" /><XAxis type="number" tickFormatter={(v: number) => formatBRL(v, true)} fontSize={11}/><YAxis type="category" dataKey="category" width={105} tickLine={false} axisLine={false} fontSize={11}/>
      <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle}/><Legend />
      <Bar name="Período atual" dataKey="value" fill="var(--chart-3)" radius={[0, 6, 6, 0]} maxBarSize={18}/><Bar name="Período anterior" dataKey="previousValue" fill="var(--muted-foreground)" radius={[0, 6, 6, 0]} maxBarSize={18}/>
    </BarChart></ResponsiveContainer>
  </div>;
}

export function WealthChart({ data }: { data: WealthPoint[] }) {
  return <div className="h-80 min-w-0" role="img" aria-label="Evolução do patrimônio líquido">
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4"/><XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12}/><YAxis tickFormatter={(v: number) => formatBRL(v, true)} tickLine={false} axisLine={false} width={72} fontSize={11}/><Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle}/><Legend />
      <Area name="Ativos" dataKey="assets" stackId="wealth" fill="var(--chart-2)" stroke="var(--chart-2)" fillOpacity={0.3}/><Area name="Passivos" dataKey="liabilities" stackId="wealth" fill="var(--chart-3)" stroke="var(--chart-3)" fillOpacity={0.3}/><Line name="Patrimônio líquido" dataKey="netWorth" stroke="var(--chart-1)" strokeWidth={3}/>
    </ComposedChart></ResponsiveContainer>
  </div>;
}

export function DestinationChart({ data }: { data: ReportDestination[] }) {
  return <div className="h-64 min-w-0" role="img" aria-label="Destinação da sobra financeira">
    <ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" fontSize={11}/><YAxis tickFormatter={(v: number) => formatBRL(v, true)} width={70} fontSize={11}/><Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle}/><Legend/><Bar name="Cofrinhos" dataKey="savings" stackId="a" fill="var(--chart-2)"/><Bar name="Investimentos" dataKey="investments" stackId="a" fill="var(--chart-1)"/></BarChart></ResponsiveContainer>
  </div>;
}

export function PaymentMethodChart({ data }: { data: Array<{ method: string; value: number; percent: number }> }) {
  return <div className="h-72 min-w-0" role="img" aria-label="Gastos por meio de pagamento"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="method" innerRadius={55} outerRadius={95} paddingAngle={2}>{data.map((item, index) => <Cell key={item.method} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle}/><Legend verticalAlign="bottom" iconType="circle"/></PieChart></ResponsiveContainer></div>;
}
