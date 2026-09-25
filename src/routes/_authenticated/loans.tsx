import { DataState } from "@/components/finance/DataState";
import { EmptyState } from "@/components/finance/EmptyState";
import { FinancialForm } from "@/components/finance/FinancialForm";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { ValidatedInput } from "@/components/finance/ValidatedInput";
import { localDateInput, parseFinancialInput } from "@/lib/financial-input";
import { createFileRoute } from "@tanstack/react-router";
import { Landmark, Plus } from "lucide-react";
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
  calculateEarlyPayoff,
  calculateLoanInterest,
  useArchiveLoan,
  useLoans,
  useSettleLoan,
  useUpsertLoan,
} from "@/lib/finance-data";
import { formatBRL, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({
    meta: [
      { title: "Empréstimos — Axionn Finance" },
      {
        name: "description",
        content: "Controle empréstimos e financiamentos: saldo devedor, parcelas e simulação de quitação.",
      },
    ],
  }),
  component: LoansPage,
});

function LoansPage() {
  const { confirm, confirmation } = useFinancialConfirmation();
  const [showArchived, setShowArchived] = useState(false);
  const { data: loans = [], isLoading, isError, error: queryError, refetch } = useLoans(showArchived);
  const upsert = useUpsertLoan();
  const settle = useSettleLoan();
  const archive = useArchiveLoan();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [installment, setInstallment] = useState("");
  const [dueDate, setDueDate] = useState(localDateInput());
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const totalRemaining = loans
    .filter((l) => l.status === "active")
    .reduce((s, l) => s + l.remaining, 0);

  const save = async () => {
    const principalValue = parseFinancialInput(principal);
    const installmentValue = parseFinancialInput(installment);
    const rateValue = parseFinancialInput(rate);
    if (!name.trim() || !Number.isFinite(principalValue) || principalValue <= 0) {
      toast.error("Informe nome e valor do empréstimo");
      return;
    }
    if (!Number.isFinite(installmentValue) || installmentValue <= 0) {
      toast.error("Informe o valor da parcela");
      return;
    }
    if (editingId && !(await confirm(`Alterar "${name}"?`))) return;
    upsert.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        name: name.trim(),
        principal: principalValue,
        interestRate: Number.isFinite(rateValue) ? rateValue : 0,
        installment: installmentValue,
        dueDate,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Empréstimo atualizado" : "Empréstimo cadastrado");
          setOpen(false);
          setEditingId(null);
          setName("");
          setPrincipal("");
          setRate("");
          setInstallment("");
        },
        onError: () =>
          toast.error("Não foi possível salvar. Confira os dados e tente novamente."),
      },
    );
  };

  const pay = async () => {
    if (!payId) return;
    const value = parseFinancialInput(payAmount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!(await confirm(`Registrar pagamento de ${formatBRL(value)}?`))) return;
    settle.mutate(
      { id: payId, amount: value },
      {
        onSuccess: () => {
          toast.success("Pagamento registrado");
          setPayOpen(false);
          setPayId(null);
          setPayAmount("");
        },
        onError: () => toast.error("Não foi possível registrar o pagamento."),
      },
    );
  };

  return (
    <AppShell>
      {confirmation}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empréstimos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError
              ? "Dados indisponíveis"
              : isLoading
                ? "Carregando…"
                : `${loans.filter((l) => l.status === "active").length} ativos · ${formatBRL(totalRemaining)} em aberto`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((v) => !v)}
          />
          {!showArchived && (
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setName("");
                setPrincipal("");
                setRate("");
                setInstallment("");
                setDueDate(localDateInput());
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Novo empréstimo
            </Button>
          )}
        </div>
      </header>

      <DataState loading={isLoading} error={queryError || isError} onRetry={() => void refetch()}>
        {loans.length === 0 && (
          <EmptyState
            icon={Landmark}
            title="Nenhum empréstimo cadastrado"
            description="Registre financiamentos e empréstimos para acompanhar saldo devedor e parcelas."
          />
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {loans.map((loan) => {
            const progress =
              loan.principal > 0 ? (loan.totalPaid / loan.principal) * 100 : 0;
            const early = calculateEarlyPayoff(loan.remaining, loan.interestRate, 12);
            return (
              <Card key={loan.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{loan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vencimento {formatLongDate(loan.dueDate)} · {loan.interestRate.toFixed(2).replace(".", ",")}% a.a.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={loan.status === "paid" ? "secondary" : "outline"}>
                      {loan.status === "paid" ? "Quitado" : "Ativo"}
                    </Badge>
                    <EntityActionsMenu
                      entityLabel="empréstimo"
                      recordName={loan.name}
                      archived={Boolean(loan.archivedAt)}
                      onEdit={() => {
                        setEditingId(loan.id);
                        setName(loan.name);
                        setPrincipal(String(loan.principal));
                        setRate(String(loan.interestRate));
                        setInstallment(String(loan.installment));
                        setDueDate(loan.dueDate);
                        setOpen(true);
                      }}
                      onArchive={() =>
                        archive.mutate(loan.id, {
                          onSuccess: () => toast.success("Empréstimo arquivado"),
                          onError: () => toast.error("Não foi possível arquivar."),
                        })
                      }
                      onRestore={() => toast.info("Use a lixeira para restaurar")}
                      onDelete={() => toast.info("Arquive em vez de excluir")}
                    />
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span className="numeric">Pago {formatBRL(loan.totalPaid)}</span>
                  <span className="numeric">Restam {formatBRL(loan.remaining)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                    <p className="text-muted-foreground">Parcela</p>
                    <p className="numeric font-medium">{formatBRL(loan.installment)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                    <p className="text-muted-foreground">Juros/mês estimado</p>
                    <p className="numeric font-medium">
                      {formatBRL(
                        calculateLoanInterest(loan.remaining, loan.interestRate, 1) -
                          loan.remaining / 12,
                      )}
                    </p>
                  </div>
                </div>
                <p className={cn("mt-2 text-[11px] text-muted-foreground")}>
                  Quitação antecipada estimada: {formatBRL(early.discountedTotal)} (economia de{" "}
                  {formatBRL(early.savings)})
                </p>
                {loan.status === "active" && !showArchived && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setPayId(loan.id);
                      setPayAmount(String(loan.installment));
                      setPayOpen(true);
                    }}
                  >
                    Registrar pagamento
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </DataState>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar empréstimo" : "Novo empréstimo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="loan-name">Nome</Label>
                <ValidatedInput required id="loan-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="loan-principal">Valor total</Label>
                  <MoneyInput min={0.01} id="loan-principal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loan-installment">Parcela</Label>
                  <MoneyInput min={0.01} id="loan-installment" value={installment} onChange={(e) => setInstallment(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="loan-rate">Juros % a.a.</Label>
                  <MoneyInput min={0} id="loan-rate" value={rate} onChange={(e) => setRate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loan-due">Vencimento</Label>
                  <ValidatedInput required id="loan-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button data-financial-submit type="button" onClick={save} disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <FinancialForm>
            <DialogHeader>
              <DialogTitle>Registrar pagamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Valor pago</Label>
              <MoneyInput min={0.01} id="pay-amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <DialogFooter>
              <Button data-financial-submit type="button" onClick={pay} disabled={settle.isPending}>
                {settle.isPending ? "Registrando…" : "Confirmar"}
              </Button>
            </DialogFooter>
          </FinancialForm>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
