import { AccountAvatar } from "@/components/finance/AccountAvatar";
import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { LogoUpload } from "@/components/finance/LogoUpload";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { resolveBankLogoByCompe } from "@/lib/bank-logos";
import { parseFinancialInput } from "@/lib/financial-input";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
  const accountDetailsQuery = useQuery({
    queryKey: ["account-edit-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, institution_id, logo_url, institutions(id, code, logo_url)")
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const inst = row.institutions as { code?: string; logo_url?: string } | null;
        const resolvedLogo = row.logo_url
          ?? inst?.logo_url
          ?? (inst?.code ? resolveBankLogoByCompe(inst.code) : null);
        return { id: row.id, institution_id: row.institution_id, logo_url: resolvedLogo };
      });
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
    logo_url: null as string | null,
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
      logo_url: null,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (account: WalletSummary["accounts"][number]) => {
    setEditId(account.id);
    const institutionId =
      accountDetailsQuery.data?.find((detail) => detail.id === account.id)?.institution_id ?? "";
    const logoUrl = accountDetailsQuery.data?.find((detail) => detail.id === account.id)?.logo_url ?? null;
    setForm({
      name: account.name,
      institution: account.institution_name ?? "",
      institution_id: institutionId,
      type: account.type,
      balance: String(account.balance),
      is_primary: account.is_primary,
      logo_url: logoUrl,
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
        logo_url: form.logo_url,
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
                const logoUrl = accountDetailsQuery.data?.find((d) => d.id === account.id)?.logo_url ?? null;
                return (
                  <Card
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 shadow-none"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <AccountAvatar
                        logoUrl={logoUrl}
                        name={account.name}
                        icon={Icon}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-medium">{account.name}</p>
                          {account.is_primary && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Star className="size-3" /> Principal
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
                          !account.is_manual
                            ? "Contas importadas devem ser arquivadas."
                            : undefined
                        }
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title={showArchived ? "Nenhuma conta arquivada" : "Nenhuma conta"}
              description={showArchived
                ? "As contas arquivadas aparecerão aqui."
                : "Adicione sua primeira conta financeira."}
              {...(!showArchived ? {
                action: {
                  label: "Criar Conta",
                  onClick: handleOpenNew,
                },
              } : {})}
            />
          )}

          {/* Dialog: Criar/Editar Conta */}
        </DataState>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-md">
            <FinancialForm>
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-4">
                  <LogoUpload
                    value={form.logo_url}
                    onChange={(url) => setForm({ ...form, logo_url: url })}
                    fallbackText={form.name || form.institution || "BK"}
                  />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="account-name">Nome</Label>
                    <ValidatedInput
                      required
                      id="account-name"
                      placeholder="Ex: Conta Itaú"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instituição</Label>
                  <Select
                    value={form.institution_id}
                    onValueChange={(v) => {
                      const inst = institutions.find((i) => i.id === v);
                      const resolvedLogo = inst?.logo_url
                        ?? (inst?.code ? resolveBankLogoByCompe(inst.code) : null);
                      setForm({
                        ...form,
                        institution_id: v,
                        institution: inst?.name ?? "",
                        logo_url: form.logo_url || resolvedLogo,
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
