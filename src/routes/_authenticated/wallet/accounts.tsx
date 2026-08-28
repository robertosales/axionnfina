import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Edit,
  Landmark,
  LineChart,
  MoreVertical,
  PiggyBank,
  Plus,
  Star,
  Trash2,
  Wallet,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWalletSummary,
  useUpsertAccount,
  useArchiveAccount,
  useSetPrimaryAccount,
} from "@/hooks/use-wallet";
import { useInstitutions } from "@/lib/finance-data";
import { formatBRL } from "@/lib/format";
import type { AccountType } from "@/lib/account-service";

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
  const { data: summary, isLoading } = useWalletSummary();
  const { data: institutions = [] } = useInstitutions();
  const upsertAccount = useUpsertAccount();
  const archiveAccount = useArchiveAccount();
  const setPrimary = useSetPrimaryAccount();

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

  const handleOpenNew = () => {
    setEditId(null);
    setForm({ name: "", institution: "", institution_id: "", type: "checking", balance: "0", is_primary: false });
    setDialogOpen(true);
  };

  const handleOpenEdit = (account: (typeof summary extends { accounts: (infer A)[] } ? A : never)) => {
    setEditId(account.id);
    setForm({
      name: account.name,
      institution: account.institution_name ?? "",
      institution_id: "",
      type: account.type,
      balance: String(account.balance),
      is_primary: account.is_primary,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      await upsertAccount.mutateAsync({
        name: form.name,
        institution: form.institution,
        institution_id: form.institution_id || undefined,
        type: form.type,
        balance: parseFloat(form.balance) || 0,
        is_primary: form.is_primary,
        is_manual: true,
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
      <div className="space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contas</h1>
            <p className="text-muted-foreground">
              Gerencie suas contas financeiras.
            </p>
          </div>
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 size-4" />
            Nova Conta
          </Button>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-20 animate-pulse bg-muted" />
            ))}
          </div>
        ) : summary && summary.accounts.length > 0 ? (
          <div className="space-y-3">
            {summary.accounts.map((account) => {
              const Icon = TYPE_ICONS[account.type] ?? Wallet;
              return (
                <Card key={account.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Icon className="size-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{account.name}</p>
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
                  <div className="flex items-center gap-4">
                    <p className="text-lg font-semibold">{formatBRL(account.balance)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(account)}>
                          <Edit className="mr-2 size-4" /> Editar
                        </DropdownMenuItem>
                        {!account.is_primary && (
                          <DropdownMenuItem onClick={() => handleSetPrimary(account.id)}>
                            <CheckCircle2 className="mr-2 size-4" /> Definir como padrão
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleArchive(account.id, account.name)}
                          className="text-danger"
                        >
                          <Trash2 className="mr-2 size-4" /> Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <Wallet className="size-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma conta</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione sua primeira conta financeira.
            </p>
            <Button className="mt-4" onClick={handleOpenNew}>
              <Plus className="mr-2 size-4" /> Criar Conta
            </Button>
          </Card>
        )}

        {/* Dialog: Criar/Editar Conta */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nome</Label>
                <Input
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
                  <Input
                    id="account-balance"
                    type="number"
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
              <Button onClick={handleSave} disabled={upsertAccount.isPending}>
                {upsertAccount.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
