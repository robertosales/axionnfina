import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BarChart3, BrainCircuit, CalendarRange, CheckCircle2, CreditCard, Download, FileText, Landmark, PiggyBank, ReceiptText, RefreshCw, Scale, Target, TrendingDown, TrendingUp, WalletCards, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { DataState } from "@/components/finance/DataState";
import { ReportKpi } from "@/components/finance/reports/ReportKpi";
import { CategoryComparisonChart, CategoryDonut, DestinationChart, MonthlyFlowChart, PaymentMethodChart, SavingsRateChart, WealthChart } from "@/components/finance/reports/ReportCharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportData } from "@/hooks/use-reports";
import { useAccounts } from "@/lib/finance-data";
import { formatBRL, formatDate } from "@/lib/format";
import { exportReportCsv, exportReportPdf } from "@/lib/report-export";
import { accountLabel, buildExecutiveInsights, calculateReportMetrics, dateRangeForPreset, savingsTone, type ReportPreset, type ReportTab } from "@/lib/reports";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: z.enum(["overview", "expenses", "wealth", "credit"]).catch("overview"),
  preset: z.enum(["current", "previous", "quarter", "year", "custom"]).catch("current"),
  start: z.string().optional(), end: z.string().optional(), account: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/reports")({
  validateSearch: searchSchema,
  head: () => ({ meta: [
    { title: "Central de Inteligência Financeira — Axionn Finance" },
    { name: "description", content: "Analise despesas, patrimônio, poupança, crédito e meios de pagamento em uma DRE pessoal moderna." },
    { property: "og:title", content: "Central de Inteligência Financeira — Axionn Finance" },
    { property: "og:description", content: "Relatórios financeiros consolidados, comparativos e explicados em linguagem simples." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: ReportsPage,
});

const presetLabels: Record<ReportPreset, string> = { current: "Este mês", previous: "Mês anterior", quarter: "Últimos 3 meses", year: "Ano vigente", custom: "Personalizado" };

type ReportCategory = "Patrimônio e Orçamento" | "Controle das Contas" | "Detalhamento de Receitas e Despesas";

type CatalogEntry = {
  title: string;
  description: string;
  category: ReportCategory;
  icon: typeof Landmark;
  to: string;
  search?: (previous: Record<string, unknown>) => Record<string, unknown>;
};

const REPORT_CATALOG: CatalogEntry[] = [
  { title: "Balanço Patrimonial", description: "Ativos, passivos e patrimônio líquido no período.", category: "Patrimônio e Orçamento", icon: Landmark, to: "/reports", search: (p) => ({ ...p, tab: "wealth" }) },
  { title: "Evolução do Balanço Patrimonial", description: "Variação do patrimônio líquido ao longo do tempo.", category: "Patrimônio e Orçamento", icon: TrendingUp, to: "/reports", search: (p) => ({ ...p, tab: "wealth" }) },
  { title: "Orçamento do mês", description: "Planejado versus realizado nas categorias orçadas.", category: "Patrimônio e Orçamento", icon: PiggyBank, to: "/reports", search: (p) => ({ ...p, tab: "overview" }) },
  { title: "Evolução das Metas", description: "Progresso das metas financeiras e aportes mensais.", category: "Patrimônio e Orçamento", icon: Target, to: "/goals" },
  { title: "Fluxo de Caixa", description: "Entradas, saídas e resultado mês a mês.", category: "Controle das Contas", icon: ArrowLeftRight, to: "/reports", search: (p) => ({ ...p, tab: "overview" }) },
  { title: "Contas a Pagar", description: "Compromissos futuros com vencimento.", category: "Controle das Contas", icon: ReceiptText, to: "/bills" },
  { title: "Contas a Receber", description: "Valores a receber, como salários e reembolsos.", category: "Controle das Contas", icon: WalletCards, to: "/bills" },
  { title: "Contas Pagas", description: "Histórico de todos os pagamentos realizados.", category: "Controle das Contas", icon: CheckCircle2, to: "/bills", search: () => ({ aba: "pagas" }) },
  { title: "Contas Recebidas", description: "Histórico de todos os valores recebidos.", category: "Controle das Contas", icon: CheckCircle2, to: "/bills", search: () => ({ aba: "pagas" }) },
  { title: "Crédito e faturas", description: "Faturas abertas, renda comprometida e meios de pagamento.", category: "Controle das Contas", icon: CreditCard, to: "/reports", search: (p) => ({ ...p, tab: "credit" }) },
  { title: "Totais por Categoria", description: "Receitas e despesas agrupadas por categoria.", category: "Detalhamento de Receitas e Despesas", icon: BarChart3, to: "/reports", search: (p) => ({ ...p, tab: "expenses" }) },
  { title: "Evolução por Categoria", description: "Tendência das receitas e despesas por categoria.", category: "Detalhamento de Receitas e Despesas", icon: TrendingDown, to: "/reports", search: (p) => ({ ...p, tab: "expenses" }) },
  { title: "Lançamentos de Caixa", description: "Extrato detalhado de entradas e saídas.", category: "Detalhamento de Receitas e Despesas", icon: FileText, to: "/transactions" },
  { title: "Comparação entre Períodos", description: "Período atual contra o mês anterior.", category: "Detalhamento de Receitas e Despesas", icon: Scale, to: "/reports", search: (p) => ({ ...p, tab: "overview", preset: "previous" }) },
];

const CATALOG_FILTERS: Array<{ key: ReportCategory | "Todos"; dot?: string }> = [
  { key: "Todos" },
  { key: "Patrimônio e Orçamento", dot: "bg-primary" },
  { key: "Controle das Contas", dot: "bg-success" },
  { key: "Detalhamento de Receitas e Despesas", dot: "bg-warning" },
];

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/reports" });
  const defaultRange = dateRangeForPreset(search.preset);
  const filters = { start: search.start ?? defaultRange.start, end: search.end ?? defaultRange.end, accountId: search.account ?? null };
  const accounts = useAccounts();
  const report = useReportData(filters);
  const metrics = useMemo(() => calculateReportMetrics(report.data?.transactions ?? [], filters), [report.data?.transactions, filters.start, filters.end, filters.accountId]);
  const insights = useMemo(() => buildExecutiveInsights(metrics), [metrics]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<(typeof CATALOG_FILTERS)[number]["key"]>("Todos");
  const catalogQueryNorm = catalogQuery.trim().toLocaleLowerCase("pt-BR");
  const catalogEntries = REPORT_CATALOG.filter(
    (entry) =>
      (catalogFilter === "Todos" || entry.category === catalogFilter) &&
      (!catalogQueryNorm ||
        `${entry.title} ${entry.description}`.toLocaleLowerCase("pt-BR").includes(catalogQueryNorm)),
  );
  const selectedCategoryData = metrics.categories.find((item) => item.category === selectedCategory);
  const currentNetWorth = report.data?.wealth.at(-1)?.netWorth ?? accounts.data?.reduce((sum, account) => sum + account.balance, 0) ?? 0;
  const currentMonth = filters.end.slice(0, 7);
  const budgetRows = (report.data?.budgets ?? []).filter((row) => row.month.startsWith(currentMonth));
  const budgetPlanned = budgetRows.reduce((sum, row) => sum + row.planned, 0);
  const budgetSpent = budgetRows.reduce((sum, row) => sum + (metrics.categories.find((item) => item.category === row.category)?.value ?? 0), 0);
  const invoiceTotal = (report.data?.invoices ?? []).filter((invoice) => !["paid", "closed", "cancelled"].includes(invoice.status.toLowerCase())).reduce((sum, invoice) => sum + invoice.total, 0);
  const commitment = metrics.income > 0 ? (invoiceTotal / metrics.income) * 100 : null;
  const lastUpdated = accounts.data?.flatMap((account) => account.lastSyncedAt ? [Date.parse(account.lastSyncedAt)] : []).sort((a, b) => b - a)[0];

  const updateSearch = (patch: Partial<typeof search>) => void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  const selectPreset = (preset: ReportPreset) => { const range = dateRangeForPreset(preset); updateSearch({ preset, start: range.start, end: range.end }); };
  const setTab = (tab: string) => updateSearch({ tab: tab as ReportTab });

  return <AppShell>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary">DRE pessoal</Badge><h1 className="font-display text-2xl font-semibold sm:text-3xl">Central de Inteligência Financeira</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Entenda para onde seu dinheiro foi, como seu patrimônio evolui e quanto da renda já está comprometido.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportReportCsv(metrics, filters)}><Download/>CSV</Button><Button disabled={exportingPdf} onClick={async () => { setExportingPdf(true); try { await exportReportPdf(metrics, filters, insights, report.data?.wealth ?? []); toast.success("DRE pessoal gerada em PDF."); } catch { toast.error("Não foi possível gerar o PDF."); } finally { setExportingPdf(false); } }}><Download/>{exportingPdf ? "Gerando…" : "Exportar DRE"}</Button></div>
    </header>

    <section aria-label="Catálogo de relatórios" className="mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-52 flex-1">
          <Input
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="Pesquisar relatório"
            aria-label="Pesquisar relatório"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATALOG_FILTERS.map((filter) => (
            <Button
              key={filter.key}
              size="sm"
              variant={catalogFilter === filter.key ? "default" : "outline"}
              onClick={() => setCatalogFilter(filter.key)}
            >
              {filter.dot && <span className={cn("size-2 rounded-full", filter.dot)} aria-hidden />}
              {filter.key}
            </Button>
          ))}
        </div>
      </div>
      {catalogEntries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum relatório encontrado para essa busca.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {catalogEntries.map((entry) => (
            <Link
              key={entry.title}
              to={entry.to}
              {...(entry.search ? { search: entry.search } : {})}
              className="focus-ring rounded-xl border border-border/60 bg-card p-4 shadow-none transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <entry.icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{entry.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>

    <Card className="mb-5 p-4 shadow-none sm:p-5">
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Label>Período</Label><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(presetLabels) as ReportPreset[]).map((preset) => <Button key={preset} size="sm" variant={search.preset === preset ? "default" : "outline"} onClick={() => selectPreset(preset)}>{presetLabels[preset]}</Button>)}</div></div><div className="w-full sm:w-64"><Label htmlFor="report-account">Instituição ou conta</Label><Select value={search.account ?? "all"} onValueChange={(value) => updateSearch({ account: value === "all" ? undefined : value })}><SelectTrigger id="report-account" className="mt-2"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas as contas</SelectItem>{(accounts.data ?? []).map((account) => <SelectItem key={account.id} value={account.id}>{accountLabel(account)}</SelectItem>)}</SelectContent></Select></div></div>
      {search.preset === "custom" && <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"><div><Label htmlFor="report-start">Data inicial</Label><Input id="report-start" type="date" className="mt-2" value={filters.start} onChange={(event) => updateSearch({ start: event.target.value })}/></div><div><Label htmlFor="report-end">Data final</Label><Input id="report-end" type="date" className="mt-2" value={filters.end} onChange={(event) => updateSearch({ end: event.target.value })}/></div></div>}
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><CalendarRange className="size-3.5"/>Análise de {formatDate(filters.start)} a {formatDate(filters.end)}{lastUpdated ? ` · última sincronização ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastUpdated))}` : ""}</p>
    </Card>

    <DataState loading={report.isLoading || accounts.isLoading} error={report.error ?? accounts.error} onRetry={() => { void report.refetch(); void accounts.refetch(); }} suppressEmpty>
      <Tabs value={search.tab} onValueChange={setTab}>
        <div className="mb-5 overflow-x-auto pb-1"><TabsList className="w-max min-w-full justify-start"><TabsTrigger value="overview"><BarChart3/>Visão consolidada</TabsTrigger><TabsTrigger value="expenses"><ReceiptText/>Despesas e categorias</TabsTrigger><TabsTrigger value="wealth"><Landmark/>Patrimônio líquido</TabsTrigger><TabsTrigger value="credit"><CreditCard/>Crédito e meios</TabsTrigger></TabsList></div>

        <TabsContent value="overview" className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores consolidados"><ReportKpi label="Receitas" value={formatBRL(metrics.income)} icon={TrendingUp} change={metrics.incomeChange} tone="success"/><ReportKpi label="Despesas" value={formatBRL(metrics.expenses)} icon={TrendingDown} change={metrics.expenseChange} tone="danger"/><ReportKpi label="Resultado" value={formatBRL(metrics.result)} icon={Scale} change={metrics.resultChange} tone={metrics.result >= 0 ? "success" : "danger"}/><ReportKpi label="Taxa de poupança" value={metrics.savingsRate === null ? "Indisponível" : `${metrics.savingsRate.toFixed(1).replace(".", ",")}%`} icon={PiggyBank} tone={savingsTone(metrics.savingsRate)} note="Abaixo de 10% atenção · 20%+ excelente"/><ReportKpi label="Patrimônio líquido" value={formatBRL(currentNetWorth)} icon={Landmark}/></section>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Receitas, despesas e resultado</h2><p className="mt-1 text-sm text-muted-foreground">Evolução mensal no período selecionado.</p><MonthlyFlowChart data={metrics.monthly}/></Card><Card className="border-primary/30 bg-primary/[0.04] p-5 shadow-none"><div className="flex items-center gap-2"><BrainCircuit className="size-5 text-primary"/><h2 className="text-lg font-semibold">Resumo executivo</h2></div><p className="mt-1 text-xs text-muted-foreground">Leitura baseada exclusivamente nos números deste relatório.</p><ol className="mt-5 space-y-4">{insights.map((insight, index) => <li key={insight} className="flex gap-3 text-sm"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><span>{insight}</span></li>)}</ol><Button variant="outline" size="sm" className="mt-5" onClick={() => toast.info("Resumo atualizado com os dados atuais.")}><RefreshCw/>Atualizar leitura</Button></Card></section>
          <section className="grid gap-5 lg:grid-cols-2"><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Constância da poupança</h2><p className="mt-1 text-sm text-muted-foreground">Percentual da receita que permaneceu após as despesas.</p><SavingsRateChart data={metrics.monthly}/></Card><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Orçamento do mês</h2><p className="mt-1 text-sm text-muted-foreground">Planejado versus realizado nas categorias orçadas.</p><div className="mt-8 flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Realizado</p><p className="numeric text-2xl font-semibold">{formatBRL(budgetSpent)}</p></div><p className="text-sm text-muted-foreground">de {formatBRL(budgetPlanned)}</p></div><Progress className="mt-4 h-3" value={budgetPlanned > 0 ? Math.min((budgetSpent / budgetPlanned) * 100, 100) : 0}/><p className={cn("mt-3 text-sm", budgetPlanned > 0 && budgetSpent > budgetPlanned ? "text-danger" : "text-muted-foreground")}>{budgetPlanned === 0 ? "Nenhum orçamento cadastrado para este mês." : budgetSpent > budgetPlanned ? `${formatBRL(budgetSpent - budgetPlanned)} acima do planejado.` : `${formatBRL(budgetPlanned - budgetSpent)} ainda disponível.`}</p></Card></section>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-5"><section className="grid gap-5 xl:grid-cols-2"><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Para onde seu dinheiro foi</h2><p className="mt-1 text-sm text-muted-foreground">Clique em uma categoria para conferir os lançamentos.</p>{metrics.categories.length ? <CategoryDonut data={metrics.categories} onSelect={setSelectedCategory}/> : <EmptyReport text="Nenhuma despesa confirmada neste período."/>}</Card><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Comparativo por categoria</h2><p className="mt-1 text-sm text-muted-foreground">Período atual contra o período anterior equivalente.</p>{metrics.categories.length ? <CategoryComparisonChart data={metrics.categories}/> : <EmptyReport text="Ainda não há categorias para comparar."/>}</Card></section><Card className="overflow-hidden shadow-none"><div className="border-b p-5"><h2 className="text-lg font-semibold">10 maiores despesas</h2><p className="mt-1 text-sm text-muted-foreground">Os lançamentos que mais pesaram no período.</p></div><TransactionTable rows={metrics.topExpenses}/></Card></TabsContent>

        <TabsContent value="wealth" className="space-y-5"><Card className="p-5 shadow-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Evolução patrimonial líquida</h2><p className="mt-1 text-sm text-muted-foreground">Ativos menos passivos registrados mês a mês.</p></div><Badge variant="outline">{report.data?.wealth.length ? `${report.data.wealth.length} pontos históricos` : "Histórico ainda insuficiente"}</Badge></div>{report.data?.wealth.length ? <WealthChart data={report.data.wealth}/> : <EmptyReport text="O sistema começará a formar esta série conforme os snapshots mensais forem registrados."/>}</Card><div className="grid gap-5 lg:grid-cols-2"><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Destinação da sobra</h2><p className="mt-1 text-sm text-muted-foreground">Aportes efetivamente registrados em cofrinhos e investimentos.</p>{report.data?.destinations.length ? <DestinationChart data={report.data.destinations}/> : <EmptyReport text="Nenhum aporte identificado no período."/>}</Card><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Qualidade do histórico</h2><div className="mt-5 space-y-4 text-sm"><QualityRow label="Fluxo de caixa" ready={metrics.monthly.length > 0} detail="Calculado pelos lançamentos confirmados."/><QualityRow label="Patrimônio mensal" ready={(report.data?.wealth.length ?? 0) > 1} detail="Depende dos snapshots mensais existentes."/><QualityRow label="Destino da sobra" ready={(report.data?.destinations.length ?? 0) > 0} detail="Usa movimentos registrados de cofrinhos e investimentos."/><QualityRow label="Cheque especial histórico" ready={false} detail="Períodos antigos não possuem o limite vigente salvo no snapshot."/></div></Card></div></TabsContent>

        <TabsContent value="credit" className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ReportKpi label="Faturas abertas" value={formatBRL(invoiceTotal)} icon={CreditCard} tone={invoiceTotal > 0 ? "warning" : "default"}/><ReportKpi label="Renda comprometida" value={commitment === null ? "Indisponível" : `${commitment.toFixed(1).replace(".", ",")}%`} icon={WalletCards} tone={commitment === null ? "default" : commitment >= 50 ? "danger" : commitment >= 30 ? "warning" : "success"} note="Atenção em 30% · crítico em 50%"/><ReportKpi label="Dias no vermelho" value={`${report.data?.negativeDays ?? 0}`} icon={CalendarRange} tone={(report.data?.negativeDays ?? 0) > 0 ? "warning" : "success"}/><ReportKpi label="Maior uso do limite" value={formatBRL(report.data?.maxOverdraft ?? 0)} icon={TrendingDown} tone={(report.data?.maxOverdraft ?? 0) > 0 ? "danger" : "default"}/></section><section className="grid gap-5 xl:grid-cols-2"><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Meios de pagamento</h2><p className="mt-1 text-sm text-muted-foreground">Composição das despesas identificadas no extrato.</p>{metrics.methods.length ? <PaymentMethodChart data={metrics.methods}/> : <EmptyReport text="Nenhum meio de pagamento identificado."/>}</Card><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Comprometimento com faturas</h2><p className="mt-1 text-sm text-muted-foreground">Faturas abertas em relação à receita confirmada do período.</p><div className="mt-8"><div className="mb-3 flex items-end justify-between"><span className="numeric text-3xl font-semibold">{commitment === null ? "—" : `${commitment.toFixed(1).replace(".", ",")}%`}</span><span className="text-sm text-muted-foreground">{formatBRL(invoiceTotal)} em aberto</span></div><div className="relative"><Progress className="h-4" value={Math.min(commitment ?? 0, 100)}/><span className="absolute left-[30%] top-0 h-4 border-l border-warning" aria-hidden/><span className="absolute left-1/2 top-0 h-4 border-l border-danger" aria-hidden/></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>0%</span><span>Atenção 30%</span><span>Crítico 50%</span><span>100%</span></div><p className="mt-5 text-sm text-muted-foreground">{commitment === null ? "Cadastre ou importe receitas confirmadas para calcular este índice." : commitment >= 50 ? "Mais da metade da renda do período está comprometida com faturas abertas." : commitment >= 30 ? "O comprometimento já ultrapassou a faixa de atenção." : "O comprometimento está abaixo da faixa de atenção."}</p></div></Card></section><Card className="p-5 shadow-none"><h2 className="text-lg font-semibold">Parcelas e custo do cheque especial</h2><p className="mt-1 text-sm text-muted-foreground">A análise detalhada começa a ficar confiável quando número de parcelas, limite vigente e taxa mensal passam a ser registrados.</p><div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-4 text-sm"><strong>Transparência dos dados:</strong> valores históricos ausentes não são estimados. O impacto de juros só será mostrado quando a taxa da conta estiver cadastrada.</div></Card></TabsContent>
      </Tabs>
    </DataState>

    <Sheet open={Boolean(selectedCategory)} onOpenChange={(open) => !open && setSelectedCategory(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle>{selectedCategory ?? "Categoria"}</SheetTitle><SheetDescription>{selectedCategoryData ? `${formatBRL(selectedCategoryData.value)} · ${selectedCategoryData.percent.toFixed(1).replace(".", ",")}% das despesas` : "Lançamentos da categoria"}</SheetDescription></SheetHeader><div className="mt-6"><TransactionTable rows={selectedCategoryData?.transactions ?? []}/><Button asChild variant="outline" className="mt-5 w-full"><Link to="/transactions">Abrir todos os lançamentos</Link></Button></div></SheetContent></Sheet>
  </AppShell>;
}

function EmptyReport({ text }: { text: string }) { return <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">{text}</div>; }
function QualityRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) { return <div className="flex items-start justify-between gap-4 border-b pb-4 last:border-0 last:pb-0"><div><p className="font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><Badge variant="outline" className={ready ? "border-success/40 text-success" : "border-warning/40 text-warning"}>{ready ? "Disponível" : "Parcial"}</Badge></div>; }
function TransactionTable({ rows }: { rows: ReturnType<typeof calculateReportMetrics>["topExpenses"] }) { if (!rows.length) return <EmptyReport text="Nenhum lançamento encontrado."/>; return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3">Conta</th><th className="p-3">Categoria</th><th className="p-3">Meio</th><th className="p-3 text-right">Valor</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="whitespace-nowrap p-3">{formatDate(row.date)}</td><td className="max-w-56 truncate p-3 font-medium">{row.description}</td><td className="p-3 text-muted-foreground">{row.accountName}</td><td className="p-3">{row.subcategory ?? row.category}</td><td className="p-3 text-muted-foreground">{row.method ?? "Não identificado"}</td><td className="numeric whitespace-nowrap p-3 text-right text-danger">{formatBRL(Math.abs(row.amount))}</td></tr>)}</tbody></table></div>; }
