/**
 * ToolCallCards — Renderiza resultados de tool calls como cards interativos
 * dentro da interface de chat do agente.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatBRL, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ToolCallCardProps = {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  onConfirm?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
};

type TransactionMiniRow = {
  description: string;
  amount: number;
  category?: string;
  occurred_at?: string;
};

type CashflowPoint = {
  month: string;
  income: number;
  expenses: number;
};

type BudgetRow = {
  categoria: string;
  planejado: number;
  gasto: number;
  percentual: number;
};

/* ------------------------------------------------------------------ */
/* Tool: buscar_transacoes                                             */
/* ------------------------------------------------------------------ */

function TransactionsResult({ result }: { result: Record<string, unknown> }) {
  const transactions = (result.transacoes as TransactionMiniRow[]) ?? [];
  const total = (result.total as number) ?? 0;
  const quantity = (result.quantidade as number) ?? 0;

  return (
    <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Transações encontradas</h3>
        <Badge variant="secondary" className="ml-auto rounded-full text-[10px]">
          {quantity} registros
        </Badge>
      </div>

      <div className="mt-3 max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40 text-left text-muted-foreground">
              <th className="pb-1.5 font-medium">Descrição</th>
              <th className="pb-1.5 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 10).map((tx, i) => (
              <tr key={i} className="border-b border-border/20">
                <td className="py-1.5">
                  <p className="truncate font-medium">{tx.description}</p>
                  {tx.category && (
                    <p className="text-muted-foreground">{tx.category}</p>
                  )}
                </td>
                <td className={cn("numeric py-1.5 text-right font-medium", tx.amount >= 0 ? "text-income" : "text-expense")}>
                  {formatBRL(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Separator className="my-3" />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Total do filtro</span>
        <span className={cn("numeric font-semibold", total >= 0 ? "text-income" : "text-expense")}>
          {formatBRL(total)}
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tool: projecao_fluxo_caixa                                         */
/* ------------------------------------------------------------------ */

function CashflowResult({ result }: { result: Record<string, unknown> }) {
  const projection = (result.projecao as Array<{ month: string; income: number; expenses: number; projected: number }>) ?? [];

  if (projection.length === 0) {
    return (
      <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
        <p className="text-sm text-muted-foreground">Sem dados suficientes para projeção.</p>
      </Card>
    );
  }

  const data = projection.map((p) => ({
    month: new Date(p.month).toLocaleDateString("pt-BR", { month: "short" }),
    receitas: Number(p.income),
    despesas: Number(p.expenses),
    projetado: Number(p.projected),
  }));

  return (
    <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Projeção de fluxo de caixa</h3>
      </div>

      <div className="mt-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="proj-in" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="proj-out" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-expense)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickFormatter={(v: number) => formatBRL(v, true)} tickLine={false} axisLine={false} fontSize={10} width={60} />
            <RTooltip
              formatter={(v: number) => formatBRL(v)}
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="receitas" stroke="var(--color-income)" strokeWidth={2} fill="url(#proj-in)" />
            <Area type="monotone" dataKey="despesas" stroke="var(--color-expense)" strokeWidth={2} fill="url(#proj-out)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tool: status_orcamento                                              */
/* ------------------------------------------------------------------ */

function BudgetResult({ result }: { result: Record<string, unknown> }) {
  const budgets = (result as BudgetRow[]) ?? [];

  if (budgets.length === 0) {
    return (
      <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
        <p className="text-sm text-muted-foreground">Nenhum orçamento configurado para este mês.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Status do orçamento</h3>
      </div>

      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={budgets} layout="vertical" margin={{ left: 10, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => formatBRL(v, true)} tickLine={false} axisLine={false} fontSize={10} />
            <YAxis type="category" dataKey="categoria" tickLine={false} axisLine={false} fontSize={10} width={100} />
            <RTooltip
              formatter={(v: number) => formatBRL(v)}
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="planejado" name="Planejado" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="gasto" name="Realizado" fill="var(--color-chart-3)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tool: resumo_financeiro                                             */
/* ------------------------------------------------------------------ */

function FinanceSummaryResult({ result }: { result: Record<string, unknown> }) {
  const patrimonio = (result.patrimonio as number) ?? 0;
  const receitasMes = (result.receitasMes as number) ?? 0;
  const despesasMes = (result.despesasMes as number) ?? 0;
  const taxaPoupanca = (result.taxaPoupanca as number) ?? 0;
  const contas = (result.contas as Array<{ name: string; balance: number; institution: string }>) ?? [];

  return (
    <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Resumo financeiro</h3>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/60 p-2.5">
          <p className="text-[10px] text-muted-foreground">Patrimônio</p>
          <p className="numeric text-sm font-semibold">{formatBRL(patrimonio)}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2.5">
          <p className="text-[10px] text-muted-foreground">Taxa de poupança</p>
          <p className="numeric text-sm font-semibold text-success">{taxaPoupanca.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2.5">
          <p className="text-[10px] text-muted-foreground">Receitas (mês)</p>
          <p className="numeric text-sm font-semibold text-income">{formatBRL(receitasMes)}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2.5">
          <p className="text-[10px] text-muted-foreground">Despesas (mês)</p>
          <p className="numeric text-sm font-semibold text-expense">{formatBRL(despesasMes)}</p>
        </div>
      </div>

      {contas.length > 0 && (
        <>
          <Separator className="my-3" />
          <h4 className="text-xs font-medium text-muted-foreground">Contas</h4>
          <ul className="mt-1.5 space-y-1">
            {contas.map((conta, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="truncate">{conta.institution} · {conta.name}</span>
                <span className="numeric font-medium">{formatBRL(Number(conta.balance))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tool: metas                                                         */
/* ------------------------------------------------------------------ */

function GoalsResult({ result }: { result: Record<string, unknown> }) {
  const goals = (result as Array<{ title: string; target_amount: number; current_amount: number; deadline: string }>) ?? [];

  if (goals.length === 0) {
    return (
      <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
        <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Metas financeiras</h3>
      </div>

      <div className="mt-3 space-y-3">
        {goals.map((goal, i) => {
          const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
          return (
            <div key={i} className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{goal.title}</p>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {progress.toFixed(0)}%
                </Badge>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{formatBRL(goal.current_amount)}</span>
                <span>{formatBRL(goal.target_amount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tool: schedule_pix (card de confirmação)                            */
/* ------------------------------------------------------------------ */

function SchedulePixResult({
  result,
  onConfirm,
  onCancel,
}: {
  result: Record<string, unknown>;
  onConfirm?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const amount = (result.amount as number) ?? 0;
  const to = (result.to as string) ?? "Destinatário";
  const when = (result.when as string) ?? "";
  const confirmationToken = (result.confirmationToken as string) ?? "";

  return (
    <Card className="rounded-xl border border-warning/40 bg-warning/5 p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-warning" aria-hidden />
        <h3 className="text-sm font-semibold">Confirmar agendamento Pix</h3>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Valor</span>
          <span className="numeric font-semibold">{formatBRL(amount)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Destinatário</span>
          <span className="font-medium">{to}</span>
        </div>
        {when && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Data</span>
            <span className="font-medium">{formatShortDate(when)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            onConfirm?.({ confirmationToken, amount, to, when });
            toast.success("Pix agendado com sucesso!");
          }}
        >
          <CheckCircle2 className="size-3.5" /> Confirmar & Agendar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => {
            onCancel?.();
            toast.info("Agendamento cancelado.");
          }}
        >
          <X className="size-3.5" /> Cancelar
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tool: calculate_tax_preview                                         */
/* ------------------------------------------------------------------ */

function TaxPreviewResult({ result }: { result: Record<string, unknown> }) {
  return (
    <Card className="rounded-xl border-border/60 p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Prévia de impostos</h3>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Swing trade (base)</span>
          <span className="numeric font-medium">{formatBRL(Number(result.swing_gross) || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Imposto swing</span>
          <span className="numeric font-medium text-warning">{formatBRL(Number(result.swing_tax) || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Day trade</span>
          <span className="numeric font-medium text-warning">{formatBRL(Number(result.daytrade_tax) || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">FIIs</span>
          <span className="numeric font-medium text-warning">{formatBRL(Number(result.fii_tax) || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Dividendos</span>
          <span className="numeric font-medium text-income">{formatBRL(Number(result.dividends) || 0)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">DARF estimada</span>
          <span className="numeric font-semibold text-danger">{formatBRL(Number(result.darf_due) || 0)}</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tool: loading state                                                 */
/* ------------------------------------------------------------------ */

function ToolLoading({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Router principal                                                    */
/* ------------------------------------------------------------------ */

const toolLabels: Record<string, string> = {
  "tool-resumo_financeiro": "Consultando resumo financeiro",
  "tool-buscar_transacoes": "Buscando transações",
  "tool-status_orcamento": "Analisando orçamento",
  "tool-projecao_fluxo_caixa": "Projetando fluxo de caixa",
  "tool-metas": "Consultando metas",
  "tool-schedule_pix_payment": "Agendando Pix",
  "tool-create_goal": "Criando meta",
  "tool-calculate_tax_preview": "Calculando impostos",
  "tool-upsert_memory": "Salvando preferência",
};

export function ToolCallRenderer({
  toolName,
  args,
  result,
  onConfirm,
  onCancel,
}: ToolCallCardProps) {
  if (!result) {
    return <ToolLoading label={toolLabels[toolName] ?? toolName} />;
  }

  const r = result as Record<string, unknown>;

  switch (toolName) {
    case "tool-buscar_transacoes":
      return <TransactionsResult result={r} />;
    case "tool-projecao_fluxo_caixa":
      return <CashflowResult result={r} />;
    case "tool-status_orcamento":
      return <BudgetResult result={r} />;
    case "tool-resumo_financeiro":
      return <FinanceSummaryResult result={r} />;
    case "tool-metas":
      return <GoalsResult result={r} />;
    case "tool-schedule_pix_payment":
      return <SchedulePixResult result={r} onConfirm={onConfirm} onCancel={onCancel} />;
    case "tool-calculate_tax_preview":
      return <TaxPreviewResult result={r} />;
    default:
      return null;
  }
}
