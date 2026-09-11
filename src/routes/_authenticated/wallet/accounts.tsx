import { DataState } from "@/components/finance/DataState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { parseFinancialInput } from "@/lib/financial-input";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  Plus,
  Star,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useArchiveAccount,
  useArchivedAccounts,
  useSetPrimaryAccount,
  useUpsertAccount,
  useWalletSummary,
} from "@/hooks/use-wallet";
import { supabase } from "@/integrations/supabase/client";
import type { AccountType, WalletSummary } from "@/lib/account-service";
import { useEntityLifecycle, useInstitutions } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import { listConnectors } from "@/lib/pluggy.functions";

export const Route = createFileRoute("/_authenticated/wallet/accounts")({
  head: () => ({
    meta: [{ title: "Contas — Axionn Finance" }],
  }),
  component: AccountsPage,
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

function AccountsPage() {
  const { confirm, confirmation } = useFinancialConfirmation();
  const { data: summary, isLoading, isError, refetch } = useWalletSummary();
  const [showArchived, setShowArchived] = useState(false);
  const archivedAccounts = useArchivedAccounts();
  const { data: institutions = [] } = useInstitutions();
  const upsertAccount = useUpsertAccount();
  const archiveAccount = useArchiveAccount();
  const setPrimary = useSetPrimaryAccount();
  const lifecycle = useEntityLifecycle("account");
  const fetchConnectors = useServerFn(listConnectors);
  const connectorsQuery = useQuery({
    queryKey: ["pluggy", "connectors"],
    queryFn: () => fetchConnectors({ data: {} }),
    staleTime: 1000 * 60 * 30,
  });
  const accountDetailsQuery = useQuery({
    queryKey: ["account-edit-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, institution_id")
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    institution: "",
    institution_id: "",
    type: "checking" as AccountType,
    balance: "0",
    is_primary: false,
  });
  const accounts = showArchived ? (archivedAccounts.data ?? []) : (summary?.accounts ?? []);
  const accountsLoading = showArchived ? archivedAccounts.isLoading : isLoading;

  const handleOpenNew = () => {
    setEditId(null);
    setForm({
      name: "",
      institution: "",
      institution_id: "",
      type: "checking",
      balance: "0",
      is_primary: false,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (account: WalletSummary["accounts"][number]) => {
    setEditId(account.id);
    const institutionId =
      accountDetailsQuery.data?.find((detail) => detail.id === account.id)?.institution_id ?? "";
    setForm({
      name: account.name,
      institution: account.institution_name ?? "",
      institution_id: institutionId,
      type: account.type,
      balance: String(account.balance),
      is_primary: account.is_primary,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !Number.isFinite(parseFinancialInput(form.balance))) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (
        editId &&
        !(await confirm(
          `Alterar a conta “${form.name}” e seu saldo para ${formatBRL(parseFinancialInput(form.balance))}?`,
        ))
      )
        return;
      await upsertAccount.mutateAsync({
        ...(editId ? { id: editId } : { is_manual: true }),
        name: form.name,
        institution: form.institution,
        ...(form.institution_id ? { institution_id: form.institution_id } : {}),
        type: form.type,
        balance: parseFinancialInput(form.balance),
        is_primary: form.is_primary,
      });

      toast.success(editId ? "Conta atualizada" : "Conta criada");
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar conta");
    }
  };

  const handleArchive = async (id: string, name: string) => {
    try {
      await archiveAccount.mutateAsync(id);
      toast.success(`Conta "${name}" arquivada`);
    } catch {
      toast.error("Erro ao arquivar conta");
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimary.mutateAsync(id);
      toast.success("Conta padrão definida");
    } catch {
      toast.error("Erro ao definir conta padrão");
    }
  };

  return (
    <AppShell>
      {confirmation}
      <div className="space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contas</h1>
            <p className="text-muted-foreground">Gerencie suas contas financeiras.</p>
          </div>
          <div className="flex items-center gap-2">
            <LifecycleFilter
              showArchived={showArchived}
              onToggle={() => setShowArchived((value) => !value)}
            />
            {!showArchived && (
              <Button onClick={handleOpenNew}>
                <Plus className="mr-2 size-4" />
                Nova Conta
              </Button>
            )}
          </div>
        </header>
        <DataState
          loading={isLoading || (showArchived && archivedAccounts.isLoading)}
          error={isError || (showArchived && archivedAccounts.isError)}
          onRetry={() => {
            void refetch();
            void archivedAccounts.refetch();
          }}
        >
          {accountsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="h-20 animate-pulse bg-muted" />
              ))}
            </div>
          ) : accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => {
                const Icon = TYPE_ICONS[account.type] ?? Wallet;
                return (
                  <Card
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-medium">{account.name}</p>
                          {account.is_primary && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Star className="size-3" /> Principal
                            </Badge>
                          )}
                          {account.open_finance && (
                            <Badge variant="outline" className="text-[10px]">
                              Open Finance
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.institution_name ?? "Sem instituição"} ·{" "}
                          {TYPE_LABELS[account.type] ?? account.type}
                        </p>
                      </div>
                    </div>
                    <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-3">
                      <p className="numeric break-words text-lg font-semibold">
                        {formatBRL(account.balance)}
                      </p>
                      {!showArchived && !account.is_primary && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Definir como padrão"
                          onClick={() => handleSetPrimary(account.id)}
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                      )}
                      <EntityActionsMenu
                        entityLabel="conta"
                        recordName={account.name}
                        archived={showArchived}
                        onEdit={() => handleOpenEdit(account)}
                        onArchive={() => handleArchive(account.id, account.name)}
                        onRestore={() =>
                          lifecycle.restore.mutate(account.id, {
                            onSuccess: () => toast.success("Conta restaurada"),
                            onError: (error) =>
                              toast.error(
                                "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                              ),
                          })
                        }
                        onDelete={() =>
                          lifecycle.remove.mutate(account.id, {
                            onSuccess: () => toast.success("Conta excluída"),
                            onError: (error) =>
                              toast.error(
                                "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                              ),
                          })
                        }
                        deleteDisabledReason={
                          (account.record_origin ??
                            (account.is_manual ? "manual" : "open_finance")) !== "manual"
                            ? "Contas sincronizadas devem ser arquivadas ou removidas pelo consentimento Open Finance."
                            : undefined
                        }
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <Wallet className="size-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                {showArchived ? "Nenhuma conta arquivada" : "Nenhuma conta"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {showArchived
                  ? "As contas arquivadas aparecerão aqui."
                  : "Adicione sua primeira conta financeira."}
              </p>
              {!showArchived && (
                <Button className="mt-4" onClick={handleOpenNew}>
                  <Plus className="mr-2 size-4" /> Criar Conta
                </Button>
              )}
            </Card>
          )}

          {/* Instituições Pluggy (Open Finance) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Instituições disponíveis</h2>
                <p className="text-sm text-muted-foreground">
                  Conectores Open Finance da Pluggy
                  {connectorsQuery.data && !connectorsQuery.data.error
                    ? ` · ${connectorsQuery.data.total} encontrados`
                    : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => connectorsQuery.refetch()}
                disabled={connectorsQuery.isFetching}
              >
                {connectorsQuery.isFetching ? "Carregando..." : "Atualizar"}
              </Button>
            </div>

            {connectorsQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="h-20 animate-pulse bg-muted" />
                ))}
              </div>
            ) : connectorsQuery.data?.error ? (
              <Card className="p-6 text-sm text-muted-foreground">
                Não foi possível carregar as instituições da Pluggy ({connectorsQuery.data.error}).
                Verifique as credenciais configuradas.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(connectorsQuery.data?.connectors ?? []).map((connector) => (
                  <Card key={connector.id} className="flex items-center gap-3 p-4">
                    {connector.imageUrl ? (
                      <img
                        src={connector.imageUrl}
                        alt={connector.name}
                        loading="lazy"
                        className="size-9 rounded-md bg-background object-contain"
                      />
                    ) : (
                      <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                        <Landmark className="size-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{connector.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {connector.isOpenFinance && (
                          <Badge variant="outline" className="text-[10px]">
                            Open Finance
                          </Badge>
                        )}
                        {connector.isSandbox && (
                          <Badge variant="secondary" className="text-[10px]">
                            Sandbox
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {connector.type}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Dialog: Criar/Editar Conta */}
        </DataState>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-md">
            <FinancialForm>
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="account-name">Nome</Label>
                  <ValidatedInput
                    required
                    id="account-name"
                    placeholder="Ex: Conta Itaú"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instituição</Label>
                  <Select
                    value={form.institution_id}
                    onValueChange={(v) => {
                      const inst = institutions.find((i) => i.id === v);
                      setForm({
                        ...form,
                        institution_id: v,
                        institution: inst?.name ?? "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {institutions.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v as AccountType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Conta Corrente</SelectItem>
                        <SelectItem value="savings">Poupança</SelectItem>
                        <SelectItem value="credit">Cartão de Crédito</SelectItem>
                        <SelectItem value="investment">Investimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-balance">Saldo</Label>
                    <MoneyInput
                      id="account-balance"
                      step="0.01"
                      value={form.balance}
                      onChange={(e) => setForm({ ...form, balance: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  data-financial-submit
                  type="button"
                  onClick={handleSave}
                  disabled={upsertAccount.isPending}
                >
                  {upsertAccount.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </FinancialForm>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
