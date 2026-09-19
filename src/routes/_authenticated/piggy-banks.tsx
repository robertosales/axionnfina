import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { EmojiPicker } from "@/components/finance/EmojiPicker";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { parseFinancialInput } from "@/lib/financial-input";
import { formatBRL } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { Landmark, PiggyBank, Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePiggyBanks,
  useCreatePiggyBank,
  useDepositToPiggyBank,
  useWithdrawFromPiggyBank,
  useUpdatePiggyBank,
  useDeletePiggyBank,
  useTransferPiggyBank,
  useArchivePiggyBank,
  useUnarchivePiggyBank,
} from "@/hooks/use-piggy-banks";
import { PiggyBankCard } from "@/components/finance/PiggyBankCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/piggy-banks")({
  head: () => ({
    meta: [
      { title: "Cofrinhos — Axionn Finance" },
      {
        name: "description",
        content: "Crie cofrinhos para separar dinheiro do dia a dia e acompanhe seu progresso.",
      },
      { property: "og:title", content: "Cofrinhos — Axionn Finance" },
      {
        property: "og:description",
        content: "Reserve valores separados do saldo disponível com aportes e resgates manuais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PiggyBanksPage,
});

function PiggyBanksPage() {
  // --- DIALOG STATE ---
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [movementType, setMovementType] = useState<"deposit" | "withdrawal">("deposit");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // --- CREATE FORM STATE ---
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");

  // --- EDIT FORM STATE ---
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");

  // --- MOVEMENT FORM STATE ---
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  // --- TRANSFER FORM STATE ---
  const [transferToId, setTransferToId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  // --- DATA HOOKS ---
  const { data: banks = [], isLoading, isError, refetch } = usePiggyBanks(showArchived);
  const create = useCreatePiggyBank();
  const deposit = useDepositToPiggyBank();
  const withdraw = useWithdrawFromPiggyBank();
  const updatePiggyBank = useUpdatePiggyBank();
  const deletePiggyBank = useDeletePiggyBank();
  const transferPiggyBank = useTransferPiggyBank();
  const archivePiggyBank = useArchivePiggyBank();
  const unarchivePiggyBank = useUnarchivePiggyBank();

  // --- ACCOUNTS FOR SELECT ---
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-for-piggy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, balance")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- SELECTED BANK ---
  const selectedBank = banks.find((b) => b.id === selectedBankId);
  const banksForTransfer = banks.filter((b) => b.id !== selectedBankId && b.status === "active");

  // --- HANDLERS: CREATE ---
  const handleCreate = async () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), icon: icon || null, color: color || null },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setName("");
          setIcon("");
          setColor("");
        },
      },
    );
  };

  // --- HANDLERS: EDIT ---
  const handleOpenEdit = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    setEditId(bankId);
    setEditName(bank.name);
    setEditIcon(bank.icon ?? "");
    setEditColor(bank.color ?? "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return;
    await updatePiggyBank.mutateAsync({
      piggy_bank_id: editId,
      name: editName.trim(),
      icon: editIcon || null,
      color: editColor || null,
    });
    setEditOpen(false);
  };

  // --- HANDLERS: DELETE ---
  const handleOpenDelete = (bankId: string) => {
    setSelectedBankId(bankId);
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    if (bank.balance === 0) {
      setDeleteOpen(true);
    } else {
      setTransferOpen(true);
      setTransferToId("");
      setTransferAmount("");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedBankId) return;
    await deletePiggyBank.mutateAsync(selectedBankId);
    setDeleteOpen(false);
    setSelectedBankId(null);
  };

  const handleTransfer = async () => {
    if (!selectedBankId || !transferToId) return;
    const parsed = parseFinancialInput(transferAmount);
    if (parsed <= 0) return;
    await transferPiggyBank.mutateAsync({
      from_id: selectedBankId,
      to_id: transferToId,
      amount: parsed,
    });
    setTransferOpen(false);
    setSelectedBankId(null);
  };

  const handleTransferAll = async () => {
    if (!selectedBankId || !accountId) return;
    const bank = banks.find((b) => b.id === selectedBankId);
    if (!bank || bank.balance <= 0) return;
    await withdraw.mutateAsync({
      piggy_bank_id: selectedBankId,
      amount: bank.balance,
      account_id: accountId,
      note: "Resgate total para exclusão",
    });
    setTransferOpen(false);
    setSelectedBankId(null);
  };

  // --- HANDLERS: MOVEMENT ---
  const openMovement = (type: "deposit" | "withdrawal", bankId: string) => {
    setMovementType(type);
    setSelectedBankId(bankId);
    setAmount("");
    setAccountId("");
    setNote("");
    setMovementOpen(true);
  };

  const handleMovement = async () => {
    if (!selectedBankId || !accountId) return;
    const parsed = parseFinancialInput(amount);
    if (parsed <= 0) return;

    if (movementType === "deposit") {
      deposit.mutate(
        { piggy_bank_id: selectedBankId, amount: parsed, account_id: accountId, note: note || null },
        { onSuccess: () => setMovementOpen(false) },
      );
    } else {
      withdraw.mutate(
        { piggy_bank_id: selectedBankId, amount: parsed, account_id: accountId, note: note || null },
        { onSuccess: () => setMovementOpen(false) },
      );
    }
  };

  // --- HANDLERS: ARCHIVE / RESTORE ---
  const handleArchive = (bankId: string) => {
    archivePiggyBank.mutate(bankId);
  };

  const handleRestore = (bankId: string) => {
    unarchivePiggyBank.mutate(bankId);
  };

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cofrinhos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Separe dinheiro do saldo disponível para objetivos específicos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((v) => !v)}
          />
          {!showArchived && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Novo cofrinho
            </Button>
          )}
        </div>
      </header>

      <DataState loading={isLoading} error={isError} onRetry={() => void refetch()}>
        {banks.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title={showArchived ? "Nenhum cofrinho arquivado" : "Nenhum cofrinho criado"}
            description={
              showArchived
                ? "Cofrinhos arquivados aparecerão aqui."
                : "Crie cofrinhos para reservar dinheiro separado do seu saldo do dia a dia."
            }
            {...(!showArchived ? { action: { label: "Novo cofrinho", onClick: () => setCreateOpen(true) } } : {})}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((bank) => (
              <PiggyBankCard
                key={bank.id}
                bank={bank}
                onDeposit={() => openMovement("deposit", bank.id)}
                onWithdraw={() => openMovement("withdrawal", bank.id)}
                onEdit={() => handleOpenEdit(bank.id)}
                onDelete={() => handleOpenDelete(bank.id)}
                archived={showArchived}
                onRestore={() => handleRestore(bank.id)}
              />
            ))}
          </div>
        )}
      </DataState>

      {/* --- CREATE DIALOG --- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Novo cofrinho</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="piggy-name">Nome</Label>
                <ValidatedInput
                  id="piggy-name"
                  placeholder="Ex: Reserva de emergência"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ícone</Label>
                  <EmojiPicker value={icon || null} onSelect={(e) => setIcon(e)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="piggy-color">Cor</Label>
                  <input
                    id="piggy-color"
                    type="color"
                    value={color || "#6366f1"}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background cursor-pointer"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                data-financial-submit
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || create.isPending}
              >
                {create.isPending ? "Criando…" : "Criar cofrinho"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>

      {/* --- EDIT DIALOG --- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Editar cofrinho</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="piggy-edit-name">Nome</Label>
                <ValidatedInput
                  id="piggy-edit-name"
                  placeholder="Ex: Reserva de emergência"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ícone</Label>
                  <EmojiPicker value={editIcon || null} onSelect={(e) => setEditIcon(e)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="piggy-edit-color">Cor</Label>
                  <input
                    id="piggy-edit-color"
                    type="color"
                    value={editColor || "#6366f1"}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background cursor-pointer"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button
                data-financial-submit
                type="button"
                onClick={handleSaveEdit}
                disabled={!editName.trim() || updatePiggyBank.isPending}
              >
                {updatePiggyBank.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>

      {/* --- MOVEMENT DIALOG --- */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="sm:max-w-md">
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>
                {movementType === "deposit" ? "Aportar" : "Resgatar"}{selectedBank ? ` — ${selectedBank.name}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="movement-amount">Valor</Label>
                <MoneyInput
                  id="movement-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-account">
                  {movementType === "deposit" ? "Debitar de" : "Creditar em"}
                </Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="movement-account">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} — {formatBRL(acc.balance)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-note">Observação (opcional)</Label>
                <ValidatedInput
                  id="movement-note"
                  placeholder="Ex: Referente a fevereiro"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                data-financial-submit
                type="button"
                onClick={handleMovement}
                disabled={!accountId || amount === "0,00" || amount === "" || deposit.isPending || withdraw.isPending}
              >
                {(deposit.isPending || withdraw.isPending)
                  ? "Processando…"
                  : movementType === "deposit"
                    ? "Confirmar aporte"
                    : "Confirmar resgate"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>

      {/* --- DELETE CONFIRM DIALOG (balance = 0) --- */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cofrinho?</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedBank?.name}" será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- TRANSFER DIALOG (balance > 0) --- */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Saldo pendente — {selectedBank?.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Este cofrinho possui <strong>{formatBRL(selectedBank?.balance ?? 0)}</strong>.
              Escolha uma opção antes de excluir:
            </p>
            <div className="space-y-4 pt-2">
              {/* Opção: Transferir para outro cofrinho */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">🔄 Transferir para outro cofrinho</p>
                <div className="space-y-2">
                  <Select value={transferToId} onValueChange={setTransferToId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Cofrinho destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {banksForTransfer.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.icon ?? "🐷"} {b.name} — {formatBRL(b.balance)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <MoneyInput
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="Valor a transferir"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!transferToId || transferAmount === "" || transferAmount === "0,00" || transferPiggyBank.isPending}
                    onClick={handleTransfer}
                  >
                    {transferPiggyBank.isPending ? "Transferindo…" : "Transferir"}
                  </Button>
                </div>
              </div>

              {/* Opção: Resgatar para conta */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">💰 Resgatar tudo para uma conta</p>
                <div className="space-y-2">
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Conta destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} — {formatBRL(acc.balance)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!accountId || withdraw.isPending}
                    onClick={handleTransferAll}
                  >
                    {withdraw.isPending ? "Resgatando…" : `Resgatar ${formatBRL(selectedBank?.balance ?? 0)}`}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTransferOpen(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
