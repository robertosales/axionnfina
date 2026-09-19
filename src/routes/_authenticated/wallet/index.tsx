import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { AccountAvatar } from "@/components/finance/AccountAvatar";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
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
import { supabase } from "@/integrations/supabase/client";
import { resolveBankLogoByCompe } from "@/lib/bank-logos";
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
  const { data: accountLogos = [] } = useQuery({
    queryKey: ["account-logos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, logo_url, institutions(code, logo_url)")
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const inst = row.institutions as { code?: string; logo_url?: string } | null;
        const resolvedLogo = row.logo_url
          ?? inst?.logo_url
          ?? (inst?.code ? resolveBankLogoByCompe(inst.code) : null);
        return { id: row.id, logo_url: resolvedLogo };
      });
    },
  });

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
                <Card className="shadow-none bg-card p-5">
                  <p className="text-sm text-muted-foreground">Patrimônio Líquido</p>
                  <p className="numeric mt-1 text-2xl font-bold">
                    {formatBRL(summary.totals.total_balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.totals.total_accounts} contas ativas
                  </p>
                </Card>
                <Card className="shadow-none bg-card p-5">
                  <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                  <p className="numeric mt-1 text-2xl font-bold text-chart-2">
                    {formatBRL(summary.totals.liquid_balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">Corrente + Poupança</p>
                </Card>
                <Card className="shadow-none bg-card p-5">
                  <p className="text-sm text-muted-foreground">Investimentos</p>
                  <p className="numeric mt-1 text-2xl font-bold text-chart-1">
                    {formatBRL(summary.totals.investment_balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.totals.investment_count} contas
                  </p>
                </Card>
                <Card className="shadow-none bg-card p-5">
                  <p className="text-sm text-muted-foreground">Limite de Crédito</p>
                  <p className="numeric mt-1 text-2xl font-bold text-chart-4">
                    {formatBRL(summary.totals.total_credit_limit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Disponível: {formatBRL(summary.totals.total_available_credit ?? 0)}
                  </p>
                </Card>
              </div>

              {/* Por Instituição */}
              {summary.by_institution && summary.by_institution.length > 0 && (
                <Card className="shadow-none bg-card p-6">
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
                        <p className="numeric font-semibold">{formatBRL(inst.balance)}</p>
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
                    const logoUrl = accountLogos.find((a) => a.id === account.id)?.logo_url ?? null;
                    return (
                      <div
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <AccountAvatar
                            logoUrl={logoUrl}
                            name={account.name}
                            icon={Icon}
                            size="sm"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{account.name}</p>
                              {account.is_primary && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Principal
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {account.institution_name ?? account.name} ·{" "}
                              {TYPE_LABELS[account.type] ?? account.type}
                            </p>
                          </div>
                        </div>
                        <p className="numeric font-semibold">{formatBRL(account.balance)}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={Wallet}
              title="Nenhuma conta cadastrada"
              description="Adicione suas contas bancárias e cartões de crédito para começar."
              action={{
                label: "Adicionar Conta",
                asChild: (
                  <Link to="/wallet/accounts">
                    <Button>Adicionar Conta</Button>
                  </Link>
                ),
              }}
            />
          )}
        </div>
      </DataState>
    </AppShell>
  );
}
