import { localDateInput } from "@/lib/financial-input";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { DataState } from "@/components/finance/DataState";
import { useFinancialConfirmation } from "@/components/finance/use-financial-confirmation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvoiceCardOptions } from "@/hooks/use-wallet";
import { supabase } from "@/integrations/supabase/client";
import { resolveInvoiceCard } from "@/lib/account-service";
import { parseInvoiceCsv, type DocumentRow } from "@/lib/document-import";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet/imports")({
  head: () => ({ meta: [{ title: "Importar fatura — Axionn Finance" }] }),
  component: InvoiceImportPage,
});

function InvoiceImportPage() {
  const { data: cards = [], isLoading, error, refetch } = useInvoiceCardOptions();
  const queryClient = useQueryClient();
  const { confirm, confirmation } = useFinancialConfirmation();
  const inputRef = useRef<HTMLInputElement>(null);
  const operation = useRef(false);
  const [selection, setSelection] = useState("");
  const [cardId, setCardId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(localDateInput().slice(0, 7));
  const [dueDate, setDueDate] = useState("");
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("csv");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedCard = cards.find((card) => card.id === selection);
  const clearPreview = () => {
    setRows([]);
    setFileName("");
    setReviewId(null);
    setCardId("");
  };

  const readFile = async (file?: File) => {
    if (!file || operation.current) return;
    if (!selectedCard) {
      toast.error("Selecione o cartão antes do arquivo.");
      return;
    }
    const extension = file.name.toLowerCase().split(".").pop();
    if (file.size > 10 * 1024 * 1024 || !["csv", "pdf"].includes(extension ?? "")) {
      toast.error("A fatura deve ser CSV ou PDF de até 10 MB.");
      return;
    }
    operation.current = true;
    setBusy(true);
    clearPreview();
    try {
      const resolvedId = await resolveInvoiceCard(selectedCard);
      let parsed: DocumentRow[];
      if (extension === "pdf") {
        const data = new FormData();
        data.append("file", file);
        data.append("kind", "credit_invoice");
        data.append("owner_id", resolvedId);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Sessão expirada");
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: data,
        });
        const result = (await response.json()) as { rows?: DocumentRow[] };
        if (!response.ok || !result.rows) throw new Error("Invalid document");
        parsed = result.rows;
      } else {
        parsed = parseInvoiceCsv(await file.text(), resolvedId);
      }
      if (!parsed.length) {
        toast.error("Nenhum item de fatura foi encontrado.");
        return;
      }
      setCardId(resolvedId);
      setFileName(file.name);
      setFileType(extension!);
      setRows(parsed);
    } catch {
      toast.error("Não foi possível ler a fatura. Confira o cartão e o arquivo e tente novamente.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const saveReview = async () => {
    const validRows = rows.filter((row) => row.valid);
    if (operation.current || !cardId || !referenceMonth || !dueDate || !validRows.length) return;
    operation.current = true;
    setBusy(true);
    try {
      if (
        !(await confirm(
          `Importar ${validRows.length} lançamento(s) de “${fileName}” para ${selectedCard?.label ?? "o cartão selecionado"}, referência ${referenceMonth.split("-").reverse().join("/")}, vencimento ${formatDate(dueDate)}? Os lançamentos confirmados atualizarão o saldo da conta. ${rows.length - validRows.length} linha(s) inválida(s) serão ignoradas.`,
        ))
      )
        return;
      let invoiceId = reviewId;
      if (!invoiceId) {
        const result = await supabase.rpc("create_credit_invoice_review", {
          p_card_id: cardId,
          p_reference_month: `${referenceMonth}-01`,
          p_due_date: dueDate,
          p_file_name: fileName,
          p_file_type: fileType,
          p_items: validRows.map((row) => ({
            date: row.date,
            description: row.description,
            amount: row.amount,
            installment: row.installment,
            external_id: row.externalId,
          })),
        });
        if (result.error) throw result.error;
        invoiceId = result.data;
        setReviewId(invoiceId);
      }
      const result = await supabase.rpc("confirm_credit_invoice", { p_invoice_id: invoiceId });
      if (result.error) throw result.error;
      toast.success(`${result.data} lançamento(s) criado(s).`);
      clearPreview();
      setSelection(cardId);
      for (const key of [
        "transactions",
        "accounts",
        "wallet-summary",
        "credit-cards",
        "invoice-card-options",
        "budgets",
        "account-reconciliation",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    } catch {
      toast.error(
        "Não foi possível concluir a importação. Sua prévia foi mantida para tentar novamente.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  return (
    <AppShell>
      {confirmation}
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Importar fatura</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confira compras e parcelas antes de criar lançamentos.
          </p>
          <Link
            to="/transactions"
            search={{ import: true }}
            className="mt-3 inline-block text-sm text-primary underline"
          >
            Importar extrato de uma conta
          </Link>
        </header>
        <DataState loading={isLoading} error={error} onRetry={() => void refetch()}>
          {!cards.length ? (
            <Card className="space-y-3 p-5">
              <p>
                Nenhum cartão cadastrado. Crie uma conta do tipo Cartão de Crédito para importar a
                fatura.
              </p>
              <Button asChild>
                <Link to="/wallet/accounts">Cadastrar cartão</Link>
              </Button>
            </Card>
          ) : (
            <Card className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invoice-card">Cartão</Label>
                  <Select
                    value={selection}
                    disabled={busy}
                    onValueChange={(value) => {
                      setSelection(value);
                      clearPreview();
                    }}
                  >
                    <SelectTrigger id="invoice-card">
                      <SelectValue placeholder="Selecione o cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {cards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference-month">Mês de referência</Label>
                  <Input
                    id="reference-month"
                    type="month"
                    value={referenceMonth}
                    disabled={busy || Boolean(reviewId)}
                    onChange={(event) => setReferenceMonth(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due-date">Vencimento</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    required
                    disabled={busy || Boolean(reviewId)}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
              </div>
              <input
                aria-label="Arquivo da fatura"
                ref={inputRef}
                type="file"
                accept=".csv,.pdf,text/csv,application/pdf"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void readFile(file);
                }}
              />
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={!selectedCard || busy}
              >
                <Upload className="size-4" /> {busy ? "Processando…" : "Selecionar CSV ou PDF"}
              </Button>
            </Card>
          )}
        </DataState>
        {rows.length > 0 && (
          <Card className="space-y-4 p-5">
            <p className="break-all text-sm font-medium">{fileName}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{rows.filter((row) => row.valid).length} válidos</Badge>
              <Badge variant="outline">{rows.filter((row) => !row.valid).length} rejeitados</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Data</th>
                    <th>Estabelecimento</th>
                    <th>Parcela</th>
                    <th className="text-right">Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowNumber} className="border-b">
                      <td className="p-2">
                        {row.date ? row.date.split("-").reverse().join("/") : "—"}
                      </td>
                      <td>{row.description || "—"}</td>
                      <td>{row.installment || "À vista"}</td>
                      <td className="numeric text-right">
                        {Number.isFinite(row.amount) ? formatBRL(row.amount) : "—"}
                      </td>
                      <td className={row.valid ? "text-success" : "text-danger"}>
                        {row.valid ? "Pronto" : row.errors.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!dueDate && (
              <p className="text-sm text-muted-foreground">
                Informe o vencimento para confirmar a importação.
              </p>
            )}
            <Button
              onClick={() => void saveReview()}
              disabled={busy || !dueDate || !referenceMonth || !rows.some((row) => row.valid)}
            >
              {busy ? "Processando…" : "Confirmar importação da fatura"}
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
