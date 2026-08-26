import { createFileRoute } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
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
import { usePayables, useReceivables, useSettlePayable, useUpsertPayable } from "@/lib/finance-data";
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
  const { data: bills = [], isLoading } = usePayables();
  const { data: receivables = [] } = useReceivables();
  const upsert = useUpsertPayable();
  const settle = useSettlePayable();

  const [open, setOpen] = useState(false);
  const [line, setLine] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [barcode, setBarcode] = useState<string | null>(null);

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
      { description: description.trim(), amount: value, dueDate, barcode },
      {
        onSuccess: () => {
          toast.success("Conta cadastrada");
          setOpen(false);
          setLine("");
          setDescription("");
          setAmount("");
          setBarcode(null);
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
        <Button size="sm" onClick={() => setOpen(true)}>
          <Upload className="size-4" /> Enviar boleto
        </Button>
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
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {receivables.length > 0 && (
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
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova conta a pagar</DialogTitle>
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
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
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
    </AppShell>
  );
}
