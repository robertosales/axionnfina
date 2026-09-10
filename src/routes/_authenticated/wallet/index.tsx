import { DataState } from "@/components/finance/DataState";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  Plus,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useWalletSummary } from "@/hooks/use-wallet";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet/")({
  head: () => ({
    meta: [
      { title: "Minha Carteira — Axionn Finance" },
      {
        name: "description",
        content: "Visão consolidada de todas as suas contas financeiras.",
      },
    ],
  }),
  component: WalletPage,
});

const TYPE_ICONS: Record<string, typeof Wallet> = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  investment: LineChart,
};

const TYPE_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  credit: "Cartão de Crédito",
  investment: "Investimento",
};

function WalletPage() {
  const { data: summary, isLoading, isError, refetch } = useWalletSummary();

  return (
    <AppShell>
      <DataState loading={isLoading} error={isError} onRetry={() => void refetch()}>
        <div className="space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Minha Carteira</h1>
              <p className="text-muted-foreground">
                Visão consolidada de todas as suas contas financeiras.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/wallet/connect">
                <Button variant="outline">
                  <ArrowRightLeft className="mr-2 size-4" />
                  Conectar Banco
                </Button>
              </Link>
              <Link to="/wallet/accounts">
                <Button>
                  <Plus className="mr-2 size-4" />
                  Adicionar Conta
                </Button>
              </Link>
            </div>
          </header>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="h-32 animate-pulse bg-muted" />
              ))}
            </div>
          ) : summary ? (
            <>
              {/* KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-5">
                  <p className="text-sm text-muted-foreground">Patrimônio Líquido</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatBRL(summary.totals.total_balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.totals.total_accounts} contas ativas
                  </p>
                </Card>
                <Card className="p-5">
                  <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                  <p className="mt-1 text-2xl font-bold text-chart-2">
                    {formatBRL(summary.totals.liquid_balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">Corrente + Poupança</p>
                </Card>
                <Card className="p-5">
                  <p className="text-sm text-muted-foreground">Investimentos</p>
                  <p className="mt-1 text-2xl font-bold text-chart-1">
                    {formatBRL(summary.totals.investment_balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.totals.investment_count} contas
                  </p>
                </Card>
                <Card className="p-5">
                  <p className="text-sm text-muted-foreground">Limite de Crédito</p>
                  <p className="mt-1 text-2xl font-bold text-chart-4">
                    {formatBRL(summary.totals.total_credit_limit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Disponível: {formatBRL(summary.totals.total_available_credit ?? 0)}
                  </p>
                </Card>
              </div>

              {/* Por Instituição */}
              {summary.by_institution && summary.by_institution.length > 0 && (
                <Card className="p-6">
                  <h2 className="font-semibold">Por Instituição</h2>
                  <div className="mt-4 space-y-3">
                    {summary.by_institution.map((inst) => (
                      <div
                        key={inst.name}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="size-8 rounded-full"
                            style={{ backgroundColor: inst.logo_color ?? "#6366f1" }}
                          />
                          <div>
                            <p className="text-sm font-medium">{inst.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {inst.account_count} conta(s)
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold">{formatBRL(inst.balance)}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Lista de Contas */}
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">Todas as Contas</h2>
                  <Link to="/wallet/accounts">
                    <Button variant="ghost" size="sm">
                      Gerenciar
                    </Button>
                  </Link>
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                  {summary.accounts.map((account) => {
                    const Icon = TYPE_ICONS[account.type] ?? Wallet;
                    return (
                      <div
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="size-5 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{account.name}</p>
                              {account.is_primary && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Principal
                                </Badge>
                              )}
                              {account.open_finance && (
                                <Badge variant="outline" className="text-[10px]">
                                  Open Finance
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {account.institution_name ?? account.name} ·{" "}
                              {TYPE_LABELS[account.type] ?? account.type}
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold">{formatBRL(account.balance)}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <Wallet className="size-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma conta cadastrada</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Adicione suas contas ou conecte um banco via Open Finance.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/wallet/connect">
                  <Button variant="outline">Conectar Banco</Button>
                </Link>
                <Link to="/wallet/accounts">
                  <Button>Adicionar Conta Manual</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      </DataState>
    </AppShell>
  );
}
