import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePiggyBanks, useCreatePiggyBank, useDepositToPiggyBank, useWithdrawFromPiggyBank } from "@/hooks/use-piggy-banks";
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
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<"deposit" | "withdrawal">("deposit");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  // --- CREATE FORM STATE ---
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");

  // --- MOVEMENT FORM STATE ---
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  // --- DATA HOOKS ---
  const { data: banks = [], isLoading, isError, refetch } = usePiggyBanks();
  const create = useCreatePiggyBank();
  const deposit = useDepositToPiggyBank();
  const withdraw = useWithdrawFromPiggyBank();

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

  // --- HANDLERS ---
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

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cofrinhos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Separe dinheiro do saldo disponível para objetivos específicos.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Novo cofrinho
        </Button>
      </header>

      <DataState loading={isLoading} error={isError} onRetry={() => void refetch()}>
        {banks.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="Nenhum cofrinho criado"
            description="Crie cofrinhos para reservar dinheiro separado do seu saldo do dia a dia."
            action={{ label: "Novo cofrinho", onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((bank) => (
              <PiggyBankCard
                key={bank.id}
                bank={bank}
                onDeposit={() => openMovement("deposit", bank.id)}
                onWithdraw={() => openMovement("withdrawal", bank.id)}
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
                  <Label htmlFor="piggy-icon">Ícone (emoji)</Label>
                  <ValidatedInput
                    id="piggy-icon"
                    placeholder="Ex: 🐷"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    maxLength={4}
                  />
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
    </AppShell>
  );
}
