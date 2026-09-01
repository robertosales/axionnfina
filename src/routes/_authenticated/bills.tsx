import { createFileRoute } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { EntityActionsMenu } from "@/components/finance/EntityActionsMenu";
import { LifecycleFilter } from "@/components/finance/LifecycleFilter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  useEntityLifecycle,
  usePayables,
  useReceivables,
  useSettlePayable,
  useUpsertPayable,
  useUpsertReceivable,
} from "@/lib/finance-data";
import { parseDigitableLine } from "@/lib/boleto";
import { daysUntil, formatBRL, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({
    meta: [
      { title: "Contas a pagar — Axionn Finance" },
      {
        name: "description",
        content:
          "Controle boletos e contas a pagar, com status de agendamento, atraso e leitura automática de boletos.",
      },
      { property: "og:title", content: "Contas a pagar — Axionn Finance" },
      {
        property: "og:description",
        content: "Boletos, vencimentos e agendamentos em uma única fila de pagamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillsPage,
});

function BillsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: bills = [], isLoading } = usePayables(showArchived);
  const { data: receivables = [] } = useReceivables(showArchived);
  const upsert = useUpsertPayable();
  const upsertReceivable = useUpsertReceivable();
  const settle = useSettlePayable();
  const payableLifecycle = useEntityLifecycle("payable");
  const receivableLifecycle = useEntityLifecycle("receivable");

  const [open, setOpen] = useState(false);
  const [receivableOpen, setReceivableOpen] = useState(false);
  const [editingPayableId, setEditingPayableId] = useState<string | null>(null);
  const [editingReceivableId, setEditingReceivableId] = useState<string | null>(null);
  const [line, setLine] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [barcode, setBarcode] = useState<string | null>(null);
  const [payer, setPayer] = useState("");

  const pending = bills.filter((bill) => bill.dbStatus !== "paid");
  const total = pending.reduce((sum, bill) => sum + bill.amount, 0);

  const readBoleto = () => {
    const parsed = parseDigitableLine(line);
    if (!parsed.valid) {
      toast.error(parsed.error ?? "Boleto inválido");
      return;
    }
    setAmount(String(parsed.amount));
    if (parsed.dueDate) setDueDate(parsed.dueDate);
    setBarcode(parsed.barcode);
    if (!description) setDescription("Boleto importado");
    toast.success("Boleto lido com sucesso");
  };

  const save = () => {
    const value = Number(amount.replace(",", "."));
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Informe descrição e valor válidos");
      return;
    }
    upsert.mutate(
      {
        ...(editingPayableId ? { id: editingPayableId } : {}),
        description: description.trim(),
        amount: value,
        dueDate,
        barcode,
      },
      {
        onSuccess: () => {
          toast.success(editingPayableId ? "Conta atualizada" : "Conta cadastrada");
          setOpen(false);
          setEditingPayableId(null);
          setLine("");
          setDescription("");
          setAmount("");
          setBarcode(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const editPayable = (bill: (typeof bills)[number]) => {
    setEditingPayableId(bill.id);
    setDescription(bill.name);
    setAmount(String(bill.amount));
    setDueDate(bill.dueDate);
    setBarcode(null);
    setLine("");
    setOpen(true);
  };

  const openNewPayable = () => {
    setEditingPayableId(null);
    setDescription("");
    setAmount("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setBarcode(null);
    setLine("");
    setOpen(true);
  };

  const editReceivable = (item: (typeof receivables)[number]) => {
    setEditingReceivableId(item.id);
    setDescription(item.description);
    setAmount(String(item.amount));
    setDueDate(item.dueDate);
    setPayer(item.payer);
    setReceivableOpen(true);
  };

  const openNewReceivable = () => {
    setEditingReceivableId(null);
    setDescription("");
    setAmount("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setPayer("");
    setReceivableOpen(true);
  };

  const saveReceivable = () => {
    const value = Number(amount.replace(",", "."));
    if (!description.trim() || !payer.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Informe descrição, pagador e valor válidos");
      return;
    }
    upsertReceivable.mutate(
      {
        ...(editingReceivableId ? { id: editingReceivableId } : {}),
        description: description.trim(),
        amount: value,
        dueDate,
        payer: payer.trim(),
      },
      {
        onSuccess: () => {
          toast.success(editingReceivableId ? "Recebimento atualizado" : "Recebimento incluído");
          setReceivableOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contas a pagar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending.length} contas abertas · {formatBRL(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LifecycleFilter
            showArchived={showArchived}
            onToggle={() => setShowArchived((value) => !value)}
          />
          {!showArchived && (
            <Button size="sm" variant="outline" onClick={openNewReceivable}>
              <Plus className="size-4" /> A receber
            </Button>
          )}
          {!showArchived && (
            <Button size="sm" onClick={openNewPayable}>
              <Upload className="size-4" /> Enviar boleto
            </Button>
          )}
        </div>
      </header>

      <Card className="rounded-xl border-border/60 p-0 shadow-elevation-1">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando contas…</p>}
        {!isLoading && bills.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
        )}
        <ul className="divide-y divide-border/60">
          {bills.map((bill) => {
            const days = daysUntil(bill.dueDate);
            return (
              <li key={bill.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{bill.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatLongDate(bill.dueDate)} ·{" "}
                    {days < 0 ? `${Math.abs(days)} dias em atraso` : `em ${days} dias`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[10px]",
                      bill.status === "OVERDUE" && "border-danger/50 text-danger",
                      bill.status === "SCHEDULED" && "border-success/50 text-success",
                    )}
                  >
                    {bill.dbStatus === "paid"
                      ? "Paga"
                      : bill.status === "OVERDUE"
                        ? "Atrasada"
                        : bill.status === "SCHEDULED"
                          ? "Agendada"
                          : "Pendente"}
                  </Badge>
                  <span className="numeric w-28 text-right text-sm font-semibold">
                    {formatBRL(bill.amount)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bill.dbStatus === "paid" || settle.isPending}
                    onClick={() =>
                      settle.mutate(bill.id, {
                        onSuccess: () => toast.success("Conta baixada"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                  >
                    {bill.dbStatus === "paid" ? "Paga" : "Pagar"}
                  </Button>
                  <EntityActionsMenu
                    entityLabel="conta"
                    recordName={bill.name}
                    archived={Boolean(bill.archivedAt)}
                    onEdit={() => editPayable(bill)}
                    onArchive={() =>
                      payableLifecycle.archive.mutate(bill.id, {
                        onSuccess: () => toast.success("Conta arquivada"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onRestore={() =>
                      payableLifecycle.restore.mutate(bill.id, {
                        onSuccess: () => toast.success("Conta restaurada"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onDelete={() =>
                      payableLifecycle.remove.mutate(bill.id, {
                        onSuccess: () => toast.success("Conta excluída"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    deleteDisabledReason={
                      bill.recordOrigin !== "manual"
                        ? "Contas sincronizadas devem ser arquivadas."
                        : undefined
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {(receivables.length > 0 || !showArchived) && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-3 text-base font-semibold">Contas a receber</h2>
          <Card className="rounded-xl border-border/60 p-0 shadow-elevation-1">
            <ul className="divide-y divide-border/60">
              {receivables.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.payer} · {formatLongDate(item.dueDate)}
                    </p>
                  </div>
                  <span className="numeric text-sm font-semibold text-income">
                    {formatBRL(item.amount)}
                  </span>
                  <EntityActionsMenu
                    entityLabel="recebimento"
                    recordName={item.description}
                    archived={Boolean(item.archivedAt)}
                    onEdit={() => editReceivable(item)}
                    onArchive={() =>
                      receivableLifecycle.archive.mutate(item.id, {
                        onSuccess: () => toast.success("Recebimento arquivado"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onRestore={() =>
                      receivableLifecycle.restore.mutate(item.id, {
                        onSuccess: () => toast.success("Recebimento restaurado"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    onDelete={() =>
                      receivableLifecycle.remove.mutate(item.id, {
                        onSuccess: () => toast.success("Recebimento excluído"),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                    deleteDisabledReason={
                      item.recordOrigin !== "manual"
                        ? "Recebimentos sincronizados devem ser arquivados."
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPayableId ? "Editar conta a pagar" : "Nova conta a pagar"}
            </DialogTitle>
            <DialogDescription>
              Cole a linha digitável do boleto para preencher automaticamente valor e vencimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="line">Linha digitável</Label>
              <div className="flex gap-2">
                <Input
                  id="line"
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                  placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                />
                <Button type="button" variant="outline" onClick={readBoleto}>
                  Ler
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Valor</Label>
                <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Vencimento</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={save} disabled={upsert.isPending}>
              <Plus className="size-4" /> {upsert.isPending ? "Salvando…" : "Salvar conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receivableOpen} onOpenChange={setReceivableOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingReceivableId ? "Editar conta a receber" : "Nova conta a receber"}
            </DialogTitle>
            <DialogDescription>
              Registre valores previstos para manter a projeção de caixa atualizada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="receivable-description">Descrição</Label>
              <Input
                id="receivable-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payer">Pagador</Label>
              <Input id="payer" value={payer} onChange={(event) => setPayer(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="receivable-amount">Valor</Label>
                <Input
                  id="receivable-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receivable-due">Vencimento</Label>
                <Input
                  id="receivable-due"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveReceivable} disabled={upsertReceivable.isPending}>
              {upsertReceivable.isPending ? "Salvando…" : "Salvar recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
