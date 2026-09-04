import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreditCards } from "@/hooks/use-wallet";
import { supabase } from "@/integrations/supabase/client";
import { parseInvoiceCsv, type DocumentRow } from "@/lib/document-import";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet/imports")({
  head: () => ({ meta: [{ title: "Importar fatura — Axionn Finance" }] }),
  component: InvoiceImportPage,
});

function InvoiceImportPage() {
  const { data: cards = [] } = useCreditCards();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cardId, setCardId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState("");
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const readFile = async (file?: File) => {
    if (!file || !cardId) {
      toast.error("Selecione o cartão antes do arquivo.");
      return;
    }
    const extension = file.name.toLowerCase().split(".").pop();
    if (file.size > 10 * 1024 * 1024 || !["csv", "pdf"].includes(extension ?? "")) {
      toast.error("A fatura deve ser CSV ou PDF de até 10 MB.");
      return;
    }
    let parsed: DocumentRow[];
    if (extension === "pdf") {
      const data = new FormData();
      data.append("file", file);
      data.append("kind", "credit_invoice");
      data.append("owner_id", cardId);
      const response = await fetch("/api/documents", { method: "POST", body: data });
      const result = (await response.json()) as { error?: string; rows?: DocumentRow[] };
      if (!response.ok || !result.rows) throw new Error(result.error ?? "Não foi possível interpretar o PDF.");
      parsed = result.rows;
    } else {
      parsed = parseInvoiceCsv(await file.text(), cardId);
    }
    if (!parsed.length) {
      toast.error("Nenhum item de fatura foi encontrado.");
      return;
    }
    setFileName(file.name);
    setRows(parsed);
  };

  const saveReview = async () => {
    const validRows = rows.filter((row) => row.valid);
    if (!cardId || !referenceMonth || validRows.length === 0) return;
    setBusy(true);
    try {
      const { data: invoiceId, error } = await supabase.rpc("create_credit_invoice_review", {
        p_card_id: cardId,
        p_reference_month: `${referenceMonth}-01`,
        p_due_date: dueDate || null,
        p_file_name: fileName,
        p_file_type: "csv",
        p_items: validRows.map((row) => ({
          date: row.date,
          description: row.description,
          amount: row.amount,
          installment: row.installment,
          external_id: row.externalId,
        })),
      });
      if (error) throw error;
      const confirmed = window.confirm("Prévia salva. Confirmar e criar os lançamentos agora?");
      if (!confirmed) {
        toast.success("Fatura salva para conferência.");
        return;
      }
      const result = await supabase.rpc("confirm_credit_invoice", { p_invoice_id: invoiceId });
      if (result.error) throw result.error;
      toast.success(`${result.data} lançamento(s) criado(s).`);
      setRows([]);
      setFileName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar a fatura.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Importar fatura</h1>
          <p className="mt-1 text-sm text-muted-foreground">Confira compras e parcelas antes de criar lançamentos.</p>
        </header>
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Cartão</Label><Select value={cardId} onValueChange={setCardId}><SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger><SelectContent>{cards.map((card) => <SelectItem key={card.id} value={card.id}>•••• {card.last_four} · {card.brand}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="reference-month">Mês de referência</Label><Input id="reference-month" type="month" value={referenceMonth} onChange={(event) => setReferenceMonth(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="due-date">Vencimento</Label><Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={!cardId}><Upload className="size-4" /> Selecionar CSV</Button>
        </Card>
        {rows.length > 0 && <Card className="space-y-4 p-5"><div className="flex flex-wrap gap-2"><Badge variant="outline">{rows.filter((row) => row.valid).length} válidos</Badge><Badge variant="outline">{rows.filter((row) => !row.valid).length} rejeitados</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Data</th><th>Estabelecimento</th><th>Parcela</th><th>Valor</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber} className="border-b"><td className="p-2">{row.date || "-"}</td><td>{row.description || "-"}</td><td>{row.installment || "À vista"}</td><td>{formatBRL(Math.abs(row.amount))}</td><td className={row.valid ? "text-success" : "text-danger"}>{row.valid ? "Pronto" : row.errors.join(", ")}</td></tr>)}</tbody></table></div><Button onClick={() => void saveReview()} disabled={busy || !rows.some((row) => row.valid)}>{busy ? "Processando…" : "Salvar prévia e confirmar"}</Button></Card>}
      </div>
    </AppShell>
  );
}
